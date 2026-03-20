// /api/upload/google-drive.js
// Faz upload de arquivos para o Google Drive da empresa e retorna link público da pasta

const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const Busboy = require('busboy');
const { Readable } = require('stream');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    return new Promise((resolve) => {
        const fields = {};
        const files = [];

        const busboy = Busboy({ headers: req.headers });

        // Coleta os fields de texto
        busboy.on('field', (name, value) => {
            fields[name] = value;
        });

        // Coleta os arquivos na memória (sem salvar em disco — compat. Vercel)
        busboy.on('file', (fieldname, fileStream, info) => {
            const chunks = [];
            fileStream.on('data', (chunk) => chunks.push(chunk));
            fileStream.on('end', () => {
                files.push({
                    fieldname,
                    filename: info.filename,
                    mimetype: info.mimeType,
                    buffer: Buffer.concat(chunks)
                });
            });
        });

        busboy.on('finish', async () => {
            const { sessionToken, tituloPedido } = fields;

            if (!sessionToken) {
                res.status(400).json({ message: 'sessionToken obrigatório.' });
                return resolve();
            }

            if (files.length === 0) {
                res.status(400).json({ message: 'Nenhum arquivo enviado.' });
                return resolve();
            }

            try {
                // 1. Busca os tokens do Drive desta empresa
                const empresas = await prisma.$queryRawUnsafe(
                    `SELECT id, gdrive_access_token, gdrive_refresh_token FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`,
                    `%${sessionToken}%`
                );

                if (empresas.length === 0) {
                    res.status(403).json({ message: 'Sessão inválida.' });
                    return resolve();
                }

                const empresa = empresas[0];

                if (!empresa.gdrive_refresh_token) {
                    res.status(403).json({ message: 'Google Drive não conectado. Autorize primeiro.', needsAuth: true });
                    return resolve();
                }

                // 2. Cria o cliente OAuth2 e define os tokens
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_REDIRECT_URI
                );

                oauth2Client.setCredentials({
                    access_token: empresa.gdrive_access_token,
                    refresh_token: empresa.gdrive_refresh_token
                });

                // Atualiza o access_token no banco se renovado
                oauth2Client.on('tokens', async (newTokens) => {
                    if (newTokens.access_token) {
                        await prisma.$executeRawUnsafe(
                            `UPDATE empresas SET gdrive_access_token = $1 WHERE id = $2`,
                            newTokens.access_token,
                            empresa.id
                        );
                    }
                });

                const drive = google.drive({ version: 'v3', auth: oauth2Client });

                // 3. Cria (ou reutiliza) a pasta "Setor de Arte" no Drive raiz
                const nomePasta = `Setor de Arte${tituloPedido ? ' - ' + tituloPedido : ''}`;
                
                // Verifica se já existe pasta com este nome
                const pastaExiste = await drive.files.list({
                    q: `name = '${nomePasta}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id)',
                    spaces: 'drive'
                });

                let folderId;
                if (pastaExiste.data.files.length > 0) {
                    folderId = pastaExiste.data.files[0].id;
                } else {
                    const pastaRes = await drive.files.create({
                        requestBody: {
                            name: nomePasta,
                            mimeType: 'application/vnd.google-apps.folder'
                        },
                        fields: 'id'
                    });
                    folderId = pastaRes.data.id;
                }

                // 4. Faz upload de cada arquivo para a pasta
                for (const arquivo of files) {
                    const stream = Readable.from(arquivo.buffer);
                    await drive.files.create({
                        requestBody: {
                            name: arquivo.filename,
                            parents: [folderId]
                        },
                        media: {
                            mimeType: arquivo.mimetype,
                            body: stream
                        }
                    });
                }

                // 5. Torna a pasta pública (qualquer pessoa com o link pode ver)
                await drive.permissions.create({
                    fileId: folderId,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone'
                    }
                });

                // 6. Obtém o link compartilhável da pasta
                const folderInfo = await drive.files.get({
                    fileId: folderId,
                    fields: 'webViewLink'
                });

                const linkPublico = folderInfo.data.webViewLink;

                console.log(`[GDrive Upload] ${files.length} arquivo(s) enviados. Pasta: ${linkPublico}`);

                res.status(200).json({
                    success: true,
                    link: linkPublico,
                    pasta: nomePasta,
                    arquivos: files.length
                });
                resolve();

            } catch (error) {
                console.error('[GDrive Upload] Erro:', error.message);
                
                // Detecta token expirado / revogado
                if (error.message?.includes('invalid_grant') || error.code === 401) {
                    // Limpa os tokens para forçar nova autorização
                    await prisma.$executeRawUnsafe(
                        `UPDATE empresas SET gdrive_access_token = NULL, gdrive_refresh_token = NULL WHERE session_tokens LIKE $1`,
                        `%${fields.sessionToken}%`
                    ).catch(() => {});
                    res.status(401).json({ message: 'Autorização do Google Drive expirada. Reconecte.', needsAuth: true });
                } else {
                    res.status(500).json({ message: 'Erro no upload: ' + error.message });
                }
                resolve();
            }
        });

        req.pipe(busboy);
    });
};

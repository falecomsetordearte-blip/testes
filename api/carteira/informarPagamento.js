// api/carteira/informarPagamento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { put } = require('@vercel/blob');
const { IncomingForm } = require('formidable');
const fs = require('fs');

export const config = {
    api: {
        bodyParser: false, // Necessário para Formidable
    },
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const form = new IncomingForm();
    
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error("Erro parsing form:", err);
            return res.status(500).json({ message: "Erro ao processar formulário." });
        }

        const sessionToken = Array.isArray(fields.sessionToken) ? fields.sessionToken[0] : fields.sessionToken;
        const acertoIdsRaw = Array.isArray(fields.acertoIds) ? fields.acertoIds[0] : fields.acertoIds;
        let comprovanteUrl = Array.isArray(fields.comprovanteUrl) ? fields.comprovanteUrl[0] : fields.comprovanteUrl;
        const comprovanteFile = files.comprovanteFile ? (Array.isArray(files.comprovanteFile) ? files.comprovanteFile[0] : files.comprovanteFile) : null;

        if (!sessionToken || !acertoIdsRaw) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        try {
            // 1. Validar Empresa
            const empresas = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);

            if (empresas.length === 0) {
                return res.status(403).json({ message: 'Sessão inválida.' });
            }

            const empresaId = empresas[0].id;

            // 2. Upload para Vercel Blob se houver arquivo
            if (comprovanteFile) {
                try {
                    const fileStream = fs.createReadStream(comprovanteFile.filepath);
                    const blob = await put(`comprovantes/${Date.now()}-${comprovanteFile.originalFilename}`, fileStream, {
                        access: 'public',
                    });
                    comprovanteUrl = blob.url;
                } catch (uploadError) {
                    console.error("Erro upload Vercel Blob:", uploadError);
                    // Continua sem o upload se falhar? Ou erro? Vamos retornar erro para garantir o comprovante.
                    return res.status(500).json({ message: "Erro ao salvar arquivo de comprovante." });
                }
            }

            // 3. Atualizar os Acertos
            const ids = acertoIdsRaw.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            
            if (ids.length === 0) {
                return res.status(400).json({ message: "IDs inválidos." });
            }

            await prisma.$executeRawUnsafe(`
                UPDATE acertos_contas 
                SET status = 'AGUARDANDO_CONFIRMACAO', 
                    pago_em = NOW(), 
                    comprovante_url = $1 
                WHERE id = ANY($2::int[]) AND empresa_id = $3
            `, comprovanteUrl || null, ids, empresaId);

            return res.status(200).json({ success: true, message: 'Pagamento informado com sucesso!', comprovanteUrl });

        } catch (error) {
            console.error("Erro ao informar pagamento:", error);
            return res.status(500).json({ message: 'Erro interno ao processar pagamento.' });
        }
    });
};

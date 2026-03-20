// /api/auth/google-drive/callback.js
// Recebe o código de autorização do Google, troca por tokens e salva no banco

const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    const { code, state, error } = req.query;

    // Página de resposta que fecha o popup e comunica com a janela pai
    const paginaResposta = (sucesso, mensagem) => `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>${sucesso ? 'Drive Conectado!' : 'Erro na Conexão'}</title>
        <style>
            body { font-family: 'Poppins', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: ${sucesso ? '#f0fdf4' : '#fff1f2'}; }
            .box { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 400px; }
            .icon { font-size: 3rem; margin-bottom: 15px; }
            h2 { color: ${sucesso ? '#16a34a' : '#dc2626'}; margin-bottom: 10px; }
            p { color: #64748b; }
        </style>
    </head>
    <body>
        <div class="box">
            <div class="icon">${sucesso ? '✅' : '❌'}</div>
            <h2>${sucesso ? 'Drive Conectado!' : 'Falha na Conexão'}</h2>
            <p>${mensagem}</p>
            <p style="font-size:0.8rem; color:#aaa; margin-top:15px;">Esta janela fechará automaticamente...</p>
        </div>
        <script>
            // Envia mensagem para a janela pai (CRM)
            if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_DRIVE_AUTH', sucesso: ${sucesso} }, '*');
            }
            setTimeout(() => window.close(), 2000);
        </script>
    </body>
    </html>`;

    if (error) {
        return res.send(paginaResposta(false, 'Autorização negada ou cancelada pelo usuário.'));
    }

    if (!code || !state) {
        return res.send(paginaResposta(false, 'Parâmetros inválidos recebidos do Google.'));
    }

    const sessionToken = decodeURIComponent(state);

    try {
        // Garante que a coluna existe (cria se não existir — sem risco de quebrar)
        await prisma.$executeRawUnsafe(`
            ALTER TABLE empresas 
            ADD COLUMN IF NOT EXISTS gdrive_access_token TEXT,
            ADD COLUMN IF NOT EXISTS gdrive_refresh_token TEXT
        `).catch(() => {}); // Ignora erros se já existir

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // Troca o código pelo par de tokens
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token && !tokens.access_token) {
            return res.send(paginaResposta(false, 'Não foi possível obter os tokens do Google.'));
        }

        // Busca a empresa pelo sessionToken
        const empresas = await prisma.$queryRawUnsafe(
            `SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`,
            `%${sessionToken}%`
        );

        if (empresas.length === 0) {
            return res.send(paginaResposta(false, 'Sessão inválida. Faça login novamente no CRM.'));
        }

        // Salva os tokens no banco
        await prisma.$executeRawUnsafe(
            `UPDATE empresas SET gdrive_access_token = $1, gdrive_refresh_token = $2 WHERE id = $3`,
            tokens.access_token,
            tokens.refresh_token || null, // refresh_token só vem na primeira autorização
            empresas[0].id
        );

        console.log(`[GDrive] Drive conectado com sucesso para empresa ID ${empresas[0].id}`);
        return res.send(paginaResposta(true, 'Seu Google Drive foi conectado com sucesso ao Setor de Arte. Agora você pode enviar arquivos diretamente pelo CRM.'));

    } catch (err) {
        console.error('[GDrive Callback] Erro:', err.message);
        return res.send(paginaResposta(false, 'Erro interno ao processar a autorização. Tente novamente.'));
    }
};

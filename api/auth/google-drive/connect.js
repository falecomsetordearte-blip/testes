// /api/auth/google-drive/connect.js
// Gera a URL de autorização OAuth2 do Google e redireciona o usuário

const { google } = require('googleapis');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { sessionToken } = req.method === 'POST' ? req.body : req.query;

    if (!sessionToken) {
        return res.status(400).json({ message: 'sessionToken obrigatório.' });
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',       // Necessário para obter refresh_token
        prompt: 'consent',            // Força apresentar tela de consentimento (garante refresh_token)
        scope: [
            'https://www.googleapis.com/auth/drive.file'  // Mínimo necessário — só arquivos do app
        ],
        state: encodeURIComponent(sessionToken)  // Passamos o sessionToken para recuperar no callback
    });

    // Retorna a URL para o front abrir num popup
    return res.status(200).json({ authUrl });
};

// /api/createGlobalNotification.js
const { Client } = require('pg');
const DATABASE_URL = process.env.DATABASE_URL;

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { titulo, mensagem, tipo, senha_admin } = req.body;

    // Segurança simples para impedir que qualquer um poste
    // Você pode mudar essa senha "admin123" para algo difícil
    if (senha_admin !== 'admin123') {
        return res.status(403).json({ message: 'Senha de administrador incorreta.' });
    }

    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        await client.query(
            `INSERT INTO notificacoes_globais (titulo, mensagem, tipo) VALUES ($1, $2, $3)`,
            [titulo, mensagem, tipo || 'info']
        );
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    } finally {
        await client.end();
    }
};
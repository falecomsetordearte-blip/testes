// /api/getGlobalNotifications.js
const { Client } = require('pg');
const DATABASE_URL = process.env.DATABASE_URL;

module.exports = async (req, res) => {
    // CORS padrão
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        
        // Pega apenas as notificações ATIVAS, ordenadas da mais nova para a mais velha
        const result = await client.query(`
            SELECT * FROM notificacoes_globais 
            WHERE ativa = TRUE 
            ORDER BY criado_em DESC 
            LIMIT 5
        `);

        return res.status(200).json(result.rows);

    } catch (error) {
        console.error("Erro notificacoes:", error);
        return res.status(500).json([]);
    } finally {
        await client.end();
    }
};
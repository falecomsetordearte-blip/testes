const axios = require('axios');
const { Client } = require('pg');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const DATABASE_URL = process.env.DATABASE_URL;

module.exports = async (req, res) => {
    // CORS headers...
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        // 1. Validar Token no Bitrix para pegar o ID do Contato
        const bitrixCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': token }, // Campo do token
            select: ['ID']
        });

        if (!bitrixCheck.data.result || bitrixCheck.data.result.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        const contactId = bitrixCheck.data.result[0].ID;

        // 2. Buscar dados no Neon usando o contactId (bitrix_id)
        await client.connect();
        const sql = `
            SELECT nome_fantasia, cnpj, whatsapp, email, responsavel, logo_id 
            FROM empresas 
            WHERE bitrix_id = $1
        `;
        const dbResult = await client.query(sql, [contactId]);

        if (dbResult.rows.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada no banco de dados.' });
        }

        return res.status(200).json(dbResult.rows[0]);

    } catch (error) {
        console.error("Erro getUserData:", error.message);
        return res.status(500).json({ message: 'Erro interno ao buscar dados.' });
    } finally {
        await client.end();
    }
};
// /api/getHelpArticles.js
// Endpoint público para buscar os artigos de ajuda ativos
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            // Busca os artigos ativos ordenados pela ordem definida no painel
            const { rows } = await pool.query(
                `SELECT id, titulo, categoria, palavras_chave, ordem, html_content 
                 FROM artigos_ajuda 
                 WHERE ativa = true 
                 ORDER BY ordem ASC, criado_em DESC`
            );
            return res.status(200).json(rows);
        } catch (error) {
            console.error('[getHelpArticles] Erro:', error);
            // Retorna vazio em vez de erro para não quebrar a tela se a tabela não tiver sido criada
            return res.status(200).json([]);
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
};

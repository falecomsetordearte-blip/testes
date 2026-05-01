// /api/admin/getAdminContent.js
// Endpoint PÚBLICO — retorna notificações sininho, popup ativo e novidades para o frontend
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    // userType: 'designer' | 'empresa' (opcional, default: todos)
    const userType = (req.query.userType || '').toLowerCase();

    try {
        // ── Filtro de destino ────────────────────────────────────
        // Retorna itens onde destino = 'todos' OU destino = userType
        const destinoFilter = userType
            ? `AND (destino = 'todos' OR destino = $1)`
            : `AND destino = 'todos'`;
        const params = userType ? [userType] : [];

        // ── Notificações do sininho ──────────────────────────────
        const notifResult = await pool.query(
            `SELECT id, titulo, mensagem, link_saiba_mais, destino, criado_em
             FROM notificacao_sininho
             WHERE ativa = true ${destinoFilter}
             ORDER BY criado_em DESC
             LIMIT 20`,
            params
        );

        // ── Popup HTML ativo mais recente ────────────────────────
        const popupResult = await pool.query(
            `SELECT id, html_content, destino, criado_em
             FROM popup_html
             WHERE ativa = true ${destinoFilter}
             ORDER BY criado_em DESC
             LIMIT 1`,
            params
        );

        // ── Novidades do sistema ─────────────────────────────────
        const novidadesResult = await pool.query(
            `SELECT id, titulo, descricao, tipo, destino, criado_em
             FROM novidade_sistema
             WHERE ativa = true ${destinoFilter}
             ORDER BY criado_em DESC
             LIMIT 10`,
            params
        );

        return res.status(200).json({
            notificacoes:  notifResult.rows,
            popup:         popupResult.rows[0] || null,
            novidades:     novidadesResult.rows
        });

    } catch (error) {
        console.error('[getAdminContent] Erro:', error);
        // Retorna vazio em vez de erro para não quebrar o layout
        return res.status(200).json({
            notificacoes: [],
            popup: null,
            novidades: []
        });
    }
};

// /api/admin/masterNotifications.js
// Endpoint protegido por ADMIN_PASS — gerencia sininho, popup e novidades
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Tabelas válidas por tipo
const TABELAS = {
    notificacao: 'notificacao_sininho',
    popup:       'popup_html',
    novidade:    'novidade_sistema'
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pass');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── Autenticação por header ──────────────────────────────────
    const adminPass = process.env.ADMIN_PASS;
    const sentPass  = req.headers['x-admin-pass'];
    if (!adminPass || sentPass !== adminPass) {
        return res.status(401).json({ message: 'Não autorizado.' });
    }

    try {
        // ── GET: listar registros ────────────────────────────────
        if (req.method === 'GET') {
            const { type } = req.query;
            const tabela = TABELAS[type];
            if (!tabela) return res.status(400).json({ message: 'Tipo inválido.' });

            const { rows } = await pool.query(
                `SELECT * FROM "${tabela}" ORDER BY criado_em DESC LIMIT 100`
            );
            return res.status(200).json(rows);
        }

        // ── POST: criar ou toggle ────────────────────────────────
        if (req.method === 'POST') {
            const { action, type } = req.body;
            const tabela = TABELAS[type];
            if (!tabela) return res.status(400).json({ message: 'Tipo inválido.' });

            // ---- CRIAR ----
            if (action === 'create') {
                if (type === 'notificacao') {
                    const { titulo, mensagem, link_saiba_mais, destino } = req.body;
                    if (!titulo || !mensagem) return res.status(400).json({ message: 'titulo e mensagem são obrigatórios.' });
                    const r = await pool.query(
                        `INSERT INTO notificacao_sininho (titulo, mensagem, link_saiba_mais, destino)
                         VALUES ($1, $2, $3, $4) RETURNING id`,
                        [titulo, mensagem, link_saiba_mais || null, destino || 'todos']
                    );
                    return res.status(200).json({ success: true, id: r.rows[0].id });
                }

                if (type === 'popup') {
                    const { html_content, destino } = req.body;
                    if (!html_content) return res.status(400).json({ message: 'html_content é obrigatório.' });
                    const r = await pool.query(
                        `INSERT INTO popup_html (html_content, destino)
                         VALUES ($1, $2) RETURNING id`,
                        [html_content, destino || 'todos']
                    );
                    return res.status(200).json({ success: true, id: r.rows[0].id });
                }

                if (type === 'novidade') {
                    const { titulo, descricao, tipo_novidade } = req.body;
                    if (!titulo || !descricao) return res.status(400).json({ message: 'titulo e descricao são obrigatórios.' });
                    const r = await pool.query(
                        `INSERT INTO novidade_sistema (titulo, descricao, tipo)
                         VALUES ($1, $2, $3) RETURNING id`,
                        [titulo, descricao, tipo_novidade || 'novo']
                    );
                    return res.status(200).json({ success: true, id: r.rows[0].id });
                }

                return res.status(200).json({ success: true });
            }

            // ---- TOGGLE ATIVA/INATIVA ----
            if (action === 'toggle') {
                const { id, ativa } = req.body;
                if (!id) return res.status(400).json({ message: 'id é obrigatório.' });
                await pool.query(
                    `UPDATE "${tabela}" SET ativa = $1 WHERE id = $2`,
                    [ativa, parseInt(id)]
                );
                return res.status(200).json({ success: true });
            }

            // ---- DELETAR ----
            if (action === 'delete') {
                const { id } = req.body;
                if (!id) return res.status(400).json({ message: 'id é obrigatório.' });
                await pool.query(`DELETE FROM "${tabela}" WHERE id = $1`, [parseInt(id)]);
                return res.status(200).json({ success: true });
            }

            return res.status(400).json({ message: 'Ação inválida.' });
        }

        return res.status(405).json({ message: 'Method not allowed' });

    } catch (error) {
        console.error('[masterNotifications] Erro:', error);
        return res.status(500).json({ message: 'Erro interno.', error: error.message });
    }
};

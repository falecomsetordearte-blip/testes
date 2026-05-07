// /api/indoor/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, etapa, query } = req.body;
        if (!sessionToken) return res.status(400).json({ message: 'Dados incompletos' });

        console.log(`[INDOOR-LISTAR] Etapa: ${etapa || 'todas'} | Query: ${query || 'nenhuma'}`);

        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const leg = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (leg.length > 0) empresaId = leg[0].id;
        }

        if (!empresaId) return res.status(403).json({ message: 'Sessão inválida' });

        console.log(`[INDOOR-LISTAR] Empresa ID: ${empresaId}`);

        let sql = `
            SELECT id, titulo, nome_cliente, whatsapp_cliente, briefing_completo,
                   etapa, created_at, updated_at
            FROM pedidos
            WHERE empresa_id = $1 AND tipo_sistema = 'indoor'
        `;
        const params = [empresaId];

        if (etapa) {
            sql += ` AND etapa = $${params.length + 1}`;
            params.push(etapa);
        }

        if (query) {
            sql += ` AND (titulo ILIKE $${params.length + 1} OR nome_cliente ILIKE $${params.length + 1})`;
            params.push(`%${query}%`);
        }

        sql += ` ORDER BY id DESC`;

        const pedidos = await prisma.$queryRawUnsafe(sql, ...params);
        console.log(`[INDOOR-LISTAR] ${pedidos.length} pedidos encontrados.`);

        const deals = pedidos.map(p => ({
            id_interno: p.id,
            titulo: p.titulo || `#${p.id}`,
            nome_cliente: p.nome_cliente,
            whatsapp: p.whatsapp_cliente,
            briefing: p.briefing_completo,
            etapa: p.etapa,
            created_at: p.created_at,
            updated_at: p.updated_at
        }));

        return res.status(200).json({ deals, empresaId });

    } catch (error) {
        console.error('[INDOOR-LISTAR] Erro:', error);
        return res.status(500).json({ message: 'Erro ao listar pedidos.' });
    }
};

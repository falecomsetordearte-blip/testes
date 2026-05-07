// /api/indoor/dashboard.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(400).json({ message: 'Dados incompletos' });

        console.log(`[INDOOR-DASHBOARD] Carregando dados...`);

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

        // Contagem por etapa
        const contagens = await prisma.$queryRawUnsafe(`
            SELECT etapa, COUNT(*) as total
            FROM pedidos
            WHERE empresa_id = $1 AND tipo_sistema = 'indoor'
              AND etapa NOT IN ('CONCLUÍDO', 'CANCELADO')
            GROUP BY etapa
        `, empresaId);

        // Total geral (ativos)
        const totalAtivos = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as total FROM pedidos
            WHERE empresa_id = $1 AND tipo_sistema = 'indoor'
              AND etapa NOT IN ('CONCLUÍDO', 'CANCELADO')
        `, empresaId);

        // Total concluídos
        const totalConcluidos = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as total FROM pedidos
            WHERE empresa_id = $1 AND tipo_sistema = 'indoor' AND etapa = 'CONCLUÍDO'
        `, empresaId);

        // Últimos 8 pedidos
        const recentes = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, nome_cliente, etapa, created_at
            FROM pedidos
            WHERE empresa_id = $1 AND tipo_sistema = 'indoor'
            ORDER BY id DESC LIMIT 8
        `, empresaId);

        const counts = { em_edicao: 0, veicular: 0, ativos: 0, concluidos: 0 };
        contagens.forEach(c => {
            const n = parseInt(c.total);
            if (c.etapa === 'EM EDIÇÃO') counts.em_edicao = n;
            if (c.etapa === 'VEICULAR') counts.veicular = n;
        });
        counts.ativos = parseInt(totalAtivos[0]?.total || 0);
        counts.concluidos = parseInt(totalConcluidos[0]?.total || 0);

        console.log(`[INDOOR-DASHBOARD] Counts:`, counts);

        return res.status(200).json({ counts, recentes });

    } catch (error) {
        console.error('[INDOOR-DASHBOARD] Erro:', error);
        return res.status(500).json({ message: 'Erro ao carregar dashboard.' });
    }
};

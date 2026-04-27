const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, query } = req.body;

        // 1. Identificar Empresa pelo Token
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) return res.status(403).json({ message: 'Sessão inválida' });

        // 2. Montar Query de busca dos clientes
        let sql = `
            SELECT 
                nome_cliente as nome, 
                MAX(whatsapp_cliente) as whatsapp,
                COUNT(id) as total_pedidos,
                SUM(COALESCE(CAST(valor_pago AS NUMERIC), 0) + COALESCE(CAST(valor_restante AS NUMERIC), 0)) as total_gasto
            FROM pedidos
            WHERE empresa_id = $1 AND nome_cliente IS NOT NULL AND nome_cliente != ''
        `;
        const params = [empresaId];

        if (query) {
            sql += ` AND (nome_cliente ILIKE $2 OR whatsapp_cliente ILIKE $2)`;
            params.push(`%${query}%`);
        }

        sql += ` GROUP BY nome_cliente ORDER BY total_pedidos DESC`;

        const clientes = await prisma.$queryRawUnsafe(sql, ...params);

        // Corrigir serialização de BigInt para JSON
        const clientesFormatados = clientes.map(c => ({
            ...c,
            total_pedidos: Number(c.total_pedidos),
            total_gasto: parseFloat(c.total_gasto || 0)
        }));

        return res.status(200).json(clientesFormatados);

    } catch (error) {
        console.error("Erro Clientes Listar:", error);
        return res.status(500).json({ message: 'Erro ao listar clientes.' });
    }
};

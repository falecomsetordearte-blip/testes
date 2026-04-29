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
        // Buscamos da tabela de marketing_clientes e trazemos as tags agregadas
        let sql = `
            SELECT 
                c.id,
                c.nome, 
                c.whatsapp,
                c.criado_em,
                (
                    SELECT json_agg(json_build_object('id', s.id, 'nome', s.nome, 'cor', s.cor))
                    FROM marketing_cliente_segmentos cs
                    JOIN marketing_segmentos s ON cs.segmento_id = s.id
                    WHERE cs.cliente_id = c.id
                ) as tags,
                COALESCE(p.total_pedidos, 0) as total_pedidos,
                COALESCE(p.total_gasto, 0) as total_gasto
            FROM marketing_clientes c
            LEFT JOIN (
                SELECT 
                    whatsapp_cliente,
                    COUNT(id) as total_pedidos,
                    SUM(COALESCE(CAST(valor_pago AS NUMERIC), 0) + COALESCE(CAST(valor_restante AS NUMERIC), 0)) as total_gasto
                FROM pedidos
                WHERE empresa_id = $1
                GROUP BY whatsapp_cliente
            ) p ON c.whatsapp = p.whatsapp_cliente
            WHERE c.empresa_id = $1
        `;
        const params = [empresaId];

        if (query) {
            sql += ` AND (c.nome ILIKE $2 OR c.whatsapp ILIKE $2)`;
            params.push(`%${query}%`);
        }

        sql += ` ORDER BY c.criado_em DESC`;

        const clientes = await prisma.$queryRawUnsafe(sql, ...params);

        // Corrigir serialização para JSON
        const clientesFormatados = clientes.map(c => ({
            ...c,
            total_pedidos: Number(c.total_pedidos),
            total_gasto: parseFloat(c.total_gasto || 0),
            tags: c.tags || []
        }));

        return res.status(200).json(clientesFormatados);

    } catch (error) {
        console.error("Erro Clientes Listar:", error);
        return res.status(500).json({ message: 'Erro ao listar clientes.' });
    }
};

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

        // 2. Query: UNION entre marketing_clientes e clientes históricos de pedidos
        // Clientes cadastrados no marketing têm prioridade e incluem tags
        // Clientes de pedidos que ainda não estão no marketing também aparecem (legado)

        let filtro = '';
        const params = [empresaId];

        if (query) {
            filtro = ` AND (nome ILIKE $2 OR whatsapp ILIKE $2)`;
            params.push(`%${query}%`);
        }

        const sql = `
            SELECT * FROM (
                -- Clientes cadastrados na tabela de marketing (prioridade, têm tags)
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
                    COALESCE(p.total_gasto, 0) as total_gasto,
                    'marketing' as origem
                FROM marketing_clientes c
                LEFT JOIN (
                    SELECT 
                        whatsapp_cliente,
                        COUNT(id) as total_pedidos,
                        SUM(COALESCE(CAST(valor_pago AS NUMERIC), 0) + COALESCE(CAST(valor_restante AS NUMERIC), 0)) as total_gasto
                    FROM pedidos
                    WHERE empresa_id = $1
                    GROUP BY whatsapp_cliente
                ) p ON REPLACE(c.whatsapp, ' ', '') = REPLACE(p.whatsapp_cliente, ' ', '')
                WHERE c.empresa_id = $1

                UNION ALL

                -- Clientes históricos de pedidos que ainda NÃO estão no marketing
                SELECT
                    NULL::int as id,
                    nome_cliente as nome,
                    MAX(whatsapp_cliente) as whatsapp,
                    MIN(created_at) as criado_em,
                    NULL as tags,
                    COUNT(id) as total_pedidos,
                    SUM(COALESCE(CAST(valor_pago AS NUMERIC), 0) + COALESCE(CAST(valor_restante AS NUMERIC), 0)) as total_gasto,
                    'pedidos' as origem
                FROM pedidos
                WHERE empresa_id = $1
                    AND nome_cliente IS NOT NULL AND nome_cliente != ''
                    AND REPLACE(COALESCE(whatsapp_cliente, ''), ' ', '') NOT IN (
                        SELECT REPLACE(whatsapp, ' ', '') FROM marketing_clientes WHERE empresa_id = $1
                    )
                GROUP BY nome_cliente
            ) clientes
            WHERE 1=1 ${filtro.replace('nome ILIKE', 'clientes.nome ILIKE').replace('whatsapp ILIKE', 'clientes.whatsapp ILIKE')}
            ORDER BY total_pedidos DESC, criado_em DESC
        `;

        // Reconstrução limpa do filtro para subquery
        let sqlFinal = `
            SELECT * FROM (
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
                    COALESCE(p.total_gasto, 0) as total_gasto,
                    'marketing' as origem
                FROM marketing_clientes c
                LEFT JOIN (
                    SELECT 
                        whatsapp_cliente,
                        COUNT(id) as total_pedidos,
                        SUM(COALESCE(CAST(valor_pago AS NUMERIC), 0) + COALESCE(CAST(valor_restante AS NUMERIC), 0)) as total_gasto
                    FROM pedidos
                    WHERE empresa_id = $1
                    GROUP BY whatsapp_cliente
                ) p ON REPLACE(c.whatsapp, ' ', '') = REPLACE(p.whatsapp_cliente, ' ', '')
                WHERE c.empresa_id = $1

                UNION ALL

                SELECT
                    NULL::int as id,
                    nome_cliente as nome,
                    MAX(whatsapp_cliente) as whatsapp,
                    MIN(created_at) as criado_em,
                    NULL as tags,
                    COUNT(id) as total_pedidos,
                    SUM(COALESCE(CAST(valor_pago AS NUMERIC), 0) + COALESCE(CAST(valor_restante AS NUMERIC), 0)) as total_gasto,
                    'pedidos' as origem
                FROM pedidos
                WHERE empresa_id = $1
                    AND nome_cliente IS NOT NULL AND nome_cliente != ''
                    AND REPLACE(COALESCE(whatsapp_cliente, ''), ' ', '') NOT IN (
                        SELECT REPLACE(whatsapp, ' ', '') FROM marketing_clientes WHERE empresa_id = $1
                    )
                GROUP BY nome_cliente
            ) clientes
        `;

        const paramsFinal = [empresaId];
        let condicoes = [];

        if (query) {
            condicoes.push(`(nome ILIKE $2 OR whatsapp ILIKE $2)`);
            paramsFinal.push(`%${query}%`);
        }

        if (condicoes.length > 0) {
            sqlFinal += ` WHERE ` + condicoes.join(' AND ');
        }

        sqlFinal += ` ORDER BY total_pedidos DESC, criado_em DESC`;

        const clientes = await prisma.$queryRawUnsafe(sqlFinal, ...paramsFinal);

        // Corrigir serialização para JSON
        const clientesFormatados = clientes.map(c => ({
            ...c,
            id: c.id ? Number(c.id) : null,
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

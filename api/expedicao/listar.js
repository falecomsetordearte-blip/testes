// api/expedicao/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, query } = req.body;
        
        if (!sessionToken) return res.status(403).json({ message: 'Não autorizado' });

        // --- DEFINIÇÃO DOS FILTROS ---
        
        // 1. IDs de fases permitidas
        const fasesPermitidas = "'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K'";

        // 2. Condição Base: Tabela pedidos
        const filtroBase = `
            bitrix_stage_id IN (${fasesPermitidas}) 
            AND (status_expedicao IS NULL OR status_expedicao != 'Entregue')
        `;

        let sqlQuery;
        let params = [];

        if (query && query.trim().length > 0) {
            const termo = query.trim();
            const termoNumero = parseInt(termo); 
            const termoTexto = `%${termo}%`;

            if (!isNaN(termoNumero)) {
                // Busca por ID na tabela PEDIDOS
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE (${filtroBase})
                    AND (
                        id = $1 
                        OR nome_cliente ILIKE $2 
                        OR titulo_automatico ILIKE $2
                        OR wpp_cliente ILIKE $2
                    )
                    ORDER BY updated_at DESC LIMIT 50
                `;
                params = [termoNumero, termoTexto];
            } else {
                // Busca por Texto na tabela PEDIDOS
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE (${filtroBase})
                    AND (
                        nome_cliente ILIKE $1 
                        OR titulo_automatico ILIKE $1
                        OR wpp_cliente ILIKE $1
                        OR servico_tipo ILIKE $1
                    )
                    ORDER BY updated_at DESC LIMIT 50
                `;
                params = [termoTexto];
            }
        } else {
            // Sem busca: Apenas Filtros Base na tabela PEDIDOS
            sqlQuery = `
                SELECT * FROM pedidos 
                WHERE ${filtroBase}
                ORDER BY updated_at DESC LIMIT 50
            `;
        }

        const pedidos = await prisma.$queryRawUnsafe(sqlQuery, ...params);
        
        // Formatação
        const pedidosFormatados = pedidos.map(p => ({
            ...p,
            id: Number(p.id),
            // Ajuste aqui se sua tabela pedidos usar outro nome para valor
            valor_orcamento: parseFloat(p.valor_orcamento || 0), 
            status_expedicao: p.status_expedicao || 'Aguardando Retirada'
        }));

        return res.status(200).json(pedidosFormatados);

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        // Dica de debug no log se der erro de coluna não existente
        return res.status(500).json({ message: 'Erro ao buscar pedidos. Verifique os nomes das colunas na tabela pedidos.' });
    }
};
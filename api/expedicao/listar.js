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
        
        // 1. IDs de fases permitidas (Finalizado/Entregue Flow, Pago, Cobrar)
        const fasesPermitidas = "'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K'";

        // 2. Condição Base: Fase válida E Não Entregue (considerando NULL como não entregue)
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
                // Busca por ID + Filtros Base
                sqlQuery = `
                    SELECT * FROM crm_oportunidades 
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
                // Busca por Texto + Filtros Base
                sqlQuery = `
                    SELECT * FROM crm_oportunidades 
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
            // Sem busca: Apenas Filtros Base
            sqlQuery = `
                SELECT * FROM crm_oportunidades 
                WHERE ${filtroBase}
                ORDER BY updated_at DESC LIMIT 50
            `;
        }

        const pedidos = await prisma.$queryRawUnsafe(sqlQuery, ...params);
        
        // Formatação para o frontend
        const pedidosFormatados = pedidos.map(p => ({
            ...p,
            id: Number(p.id),
            valor_orcamento: parseFloat(p.valor_orcamento || 0),
            // Garante que mostre 'Aguardando Retirada' se estiver NULL
            status_expedicao: p.status_expedicao || 'Aguardando Retirada'
        }));

        return res.status(200).json(pedidosFormatados);

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro ao buscar pedidos' });
    }
};
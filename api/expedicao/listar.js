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
        
        // Validação simples
        if (!sessionToken) return res.status(403).json({ message: 'Não autorizado' });

        let sqlQuery;
        let params = [];

        if (query && query.trim().length > 0) {
            const termo = query.trim();
            // Tenta converter para número (para busca por ID)
            const termoNumero = parseInt(termo); 
            const termoTexto = `%${termo}%`; // Para busca ILIKE

            if (!isNaN(termoNumero)) {
                // Se for número, busca por ID exato OU texto
                sqlQuery = `
                    SELECT * FROM crm_oportunidades 
                    WHERE id = $1 
                    OR nome_cliente ILIKE $2 
                    OR titulo_automatico ILIKE $2
                    OR wpp_cliente ILIKE $2
                    ORDER BY updated_at DESC LIMIT 50
                `;
                params = [termoNumero, termoTexto];
            } else {
                // Se for texto apenas
                sqlQuery = `
                    SELECT * FROM crm_oportunidades 
                    WHERE nome_cliente ILIKE $1 
                    OR titulo_automatico ILIKE $1
                    OR wpp_cliente ILIKE $1
                    OR servico_tipo ILIKE $1
                    ORDER BY updated_at DESC LIMIT 50
                `;
                params = [termoTexto];
            }
        } else {
            // Sem busca: Traz os últimos 50
            sqlQuery = `
                SELECT * FROM crm_oportunidades 
                ORDER BY updated_at DESC LIMIT 50
            `;
        }

        const pedidos = await prisma.$queryRawUnsafe(sqlQuery, ...params);
        
        // Tratamento de BigInt (caso o ID seja muito grande) e formatação
        const pedidosFormatados = pedidos.map(p => ({
            ...p,
            id: Number(p.id),
            valor_orcamento: parseFloat(p.valor_orcamento || 0)
        }));

        return res.status(200).json(pedidosFormatados);

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro ao buscar pedidos' });
    }
};
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

        let sqlQuery;
        let params = [];

        // Verifica se tem busca digitada
        if (query && query.trim().length > 0) {
            const termo = query.trim();
            const termoNumero = parseInt(termo); 
            const termoTexto = `%${termo}%`;

            if (!isNaN(termoNumero)) {
                // Busca por ID (Sem filtrar status)
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE (
                        id = $1 
                        OR nome_cliente ILIKE $2 
                        OR titulo_automatico ILIKE $2
                        OR wpp_cliente ILIKE $2
                    )
                    ORDER BY id DESC LIMIT 50
                `;
                params = [termoNumero, termoTexto];
            } else {
                // Busca por Texto (Sem filtrar status)
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE (
                        nome_cliente ILIKE $1 
                        OR titulo_automatico ILIKE $1
                        OR wpp_cliente ILIKE $1
                        OR servico_tipo ILIKE $1
                    )
                    ORDER BY id DESC LIMIT 50
                `;
                params = [termoTexto];
            }
        } else {
            // Sem busca: Traz TUDO (Entregues e Pendentes), ordenado pelo mais recente
            sqlQuery = `
                SELECT * FROM pedidos 
                ORDER BY id DESC LIMIT 50
            `;
        }

        const pedidos = await prisma.$queryRawUnsafe(sqlQuery, ...params);
        
        const pedidosFormatados = pedidos.map(p => ({
            ...p,
            id: Number(p.id),
            valor_orcamento: parseFloat(p.valor_orcamento || p.valor || 0), 
            status_expedicao: p.status_expedicao || 'Aguardando Retirada'
        }));

        return res.status(200).json(pedidosFormatados);

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro interno ao buscar pedidos' });
    }
};
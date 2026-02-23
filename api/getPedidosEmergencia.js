const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Permite acesso de qualquer lugar (Emergência)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { busca } = req.query;
        let whereClause = {};

        // Se você digitar algo na busca, ele filtra por título, nome ou whatsapp
        if (busca) {
            whereClause = {
                OR: [
                    { titulo: { contains: busca, mode: 'insensitive' } },
                    { nome_cliente: { contains: busca, mode: 'insensitive' } },
                    { whatsapp_cliente: { contains: busca, mode: 'insensitive' } }
                ]
            };
        }

        // Busca os últimos 200 pedidos (para não travar o banco)
        const pedidos = await prisma.pedidos.findMany({
            where: whereClause,
            orderBy: {
                id: 'desc' // Mais recentes primeiro
            },
            take: 200 
        });

        return res.status(200).json(pedidos);
    } catch (error) {
        console.error('Erro na API de emergência:', error);
        return res.status(500).json({ message: error.message });
    }
};
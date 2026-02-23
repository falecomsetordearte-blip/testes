const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Permite acesso de qualquer lugar (Emergência)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { busca } = req.query;
        let pedidos;

        // Como seu sistema usa SQL puro em outros arquivos, vamos usar aqui também
        // para garantir que ele ache a tabela "pedidos" exatamente como está no Neon.
        if (busca) {
            const termoBusca = `%${busca}%`;
            pedidos = await prisma.$queryRawUnsafe(`
                SELECT * FROM pedidos 
                WHERE titulo ILIKE $1 
                   OR nome_cliente ILIKE $1 
                   OR whatsapp_cliente ILIKE $1 
                ORDER BY id DESC 
                LIMIT 200
            `, termoBusca);
        } else {
            pedidos = await prisma.$queryRawUnsafe(`
                SELECT * FROM pedidos 
                ORDER BY id DESC 
                LIMIT 200
            `);
        }

        // Correção de segurança: SQL puro as vezes retorna IDs como BigInt, 
        // o que quebra o JSON. Isso converte qualquer BigInt para String.
        const pedidosFormatados = pedidos.map(pedido => {
            const novoPedido = {};
            for (const key in pedido) {
                novoPedido[key] = typeof pedido[key] === 'bigint' ? pedido[key].toString() : pedido[key];
            }
            return novoPedido;
        });

        return res.status(200).json(pedidosFormatados);
        
    } catch (error) {
        console.error('Erro na API de emergência:', error);
        return res.status(500).json({ message: error.message });
    }
};
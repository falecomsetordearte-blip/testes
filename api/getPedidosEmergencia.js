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

        // O comentário /* cache bust v2 */ força o PostgreSQL a criar
        // um novo plano de execução, resolvendo o erro 0A000.
        if (busca) {
            const termoBusca = `%${busca}%`;
            pedidos = await prisma.$queryRawUnsafe(`
                SELECT * FROM pedidos /* cache bust v2 */
                WHERE (titulo ILIKE $1 
                   OR nome_cliente ILIKE $1 
                   OR whatsapp_cliente ILIKE $1)
                ORDER BY id DESC 
                LIMIT 200
            `, termoBusca);
        } else {
            pedidos = await prisma.$queryRawUnsafe(`
                SELECT * FROM pedidos /* cache bust v2 */
                ORDER BY id DESC 
                LIMIT 200
            `);
        }

        // Correção de segurança para BigInt
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
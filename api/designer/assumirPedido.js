// /api/designer/assumirPedido.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        const { token, pedidoId } = req.body;

        // 1. Validar Designer
        const d = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);
        if (d.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = d[0].designer_id;

        // 2. Tentar assumir o pedido (Check se ainda está vago)
        const check = await prisma.$queryRawUnsafe(`
            SELECT id, designer_id, link_acompanhar FROM pedidos WHERE id = $1
        `, parseInt(pedidoId));

        if (check.length === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (check[0].designer_id) return res.status(400).json({ message: 'Este pedido já foi assumido por outro designer.' });

        // 3. Vincular Designer ao Pedido
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET designer_id = $1, 
                assumido_em = NOW(),
                etapa = 'ARTE' -- Mantém em arte, mas agora tem dono
            WHERE id = $2
        `, designerId, parseInt(pedidoId));

        return res.status(200).json({ 
            success: true, 
            chatLink: check[0].link_acompanhar,
            message: 'Pedido assumido! Agora você pode conversar com o cliente.' 
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
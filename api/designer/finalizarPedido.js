// /api/designer/finalizarPedido.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { token, pedidoId, linkLayout, linkImpressao } = req.body;

        if (!pedidoId || !linkLayout || !linkImpressao) {
            return res.status(400).json({ message: 'Links de layout e impressão são obrigatórios.' });
        }

        // 1. Validar Designer pelo Token
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        // 2. Buscar o pedido
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, valor_designer, titulo, empresa_id 
            FROM pedidos 
            WHERE id = $1 AND designer_id = $2 AND etapa = 'ARTE'
        `, parseInt(pedidoId), designerId);

        if (pedidos.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou já finalizado.' });
        }

        const pedido = pedidos[0];

        const valorCobrado = parseFloat(pedido.valor_designer || 0);

        // A) Gerar Acerto de Contas (Dívida da Gráfica)
        await prisma.$executeRawUnsafe(`
            INSERT INTO acertos_contas (empresa_id, designer_id, pedido_id, valor, status, criado_em)
            VALUES ($1, $2, $3, $4, 'PENDENTE', NOW())
        `, pedido.empresa_id, designerId, pedido.id, valorCobrado);

        // B) Pontuação do Designer
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET pontuacao = pontuacao + 10 
            WHERE designer_id = $1
        `, designerId);

        // C) Atualizar o Pedido
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'IMPRESSÃO', 
                link_arquivo = $1, 
                link_layout = $2,
                updated_at = NOW() 
            WHERE id = $3
        `, linkImpressao, linkLayout, parseInt(pedidoId));

        return res.status(200).json({
            success: true,
            message: `Sucesso! Arte entregue. O valor de R$ ${valorCobrado.toFixed(2).replace('.', ',')} foi registrado no seu Acerto de Contas.`
        });

    } catch (error) {
        console.error("Erro ao finalizar pedido:", error);
        return res.status(500).json({ message: 'Erro ao processar finalização do pedido.' });
    }
};
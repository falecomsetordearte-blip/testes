// /api/designer/finalizarPedido.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        const { token, pedidoId, linkLayout, linkImpressao } = req.body;

        if (!linkLayout || !linkImpressao) {
            return res.status(400).json({ message: 'Links de layout e impressão são obrigatórios.' });
        }

        // 1. Validar Designer
        const d = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);
        if (d.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = d[0].designer_id;

        // 2. Buscar dados do Pedido e da Empresa dona do pedido
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, empresa_id, valor_designer, titulo FROM pedidos 
            WHERE id = $1 AND designer_id = $2 AND etapa = 'ARTE'
        `, parseInt(pedidoId), designerId);

        if (pedidos.length === 0) return res.status(404).json({ message: 'Pedido não encontrado ou já finalizado.' });
        const pedido = pedidos[0];
        const valorComissao = parseFloat(pedido.valor_designer || 0);

        // --- TRANSAÇÃO FINANCEIRA (Neon) ---
        
        // A) Creditar no saldo do Designer
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET saldo_disponivel = saldo_disponivel + $1 
            WHERE designer_id = $2
        `, valorComissao, designerId);

        // B) Registrar saída no histórico financeiro da Empresa (para o relatório deles)
        await prisma.$executeRawUnsafe(`
            INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) 
            VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
        `, pedido.empresa_id, valorComissao, String(pedido.id), `Pagamento Designer: ${pedido.titulo}`);

        // C) Atualizar o Pedido: Salvar links, mudar etapa e marcar como pago
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'IMPRESSÃO', 
                link_arquivo = $1, -- Link de Impressão
                link_layout = $2,  -- Link do Layout
                valor_designer_pago = $3,
                updated_at = NOW() 
            WHERE id = $4
        `, linkImpressao, linkLayout, valorComissao, pedido.id);

        return res.status(200).json({ success: true, message: 'Pedido enviado para impressão e pagamento creditado!' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro ao finalizar pedido.' });
    }
};
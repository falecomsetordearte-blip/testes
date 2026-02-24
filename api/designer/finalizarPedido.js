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

        // 2. Buscar o pedido para saber o VALOR da oferta
        // (Só permite finalizar se o pedido for do designer e estiver na etapa ARTE)
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, valor_designer, titulo 
            FROM pedidos 
            WHERE id = $1 AND designer_id = $2 AND etapa = 'ARTE'
        `, parseInt(pedidoId), designerId);

        if (pedidos.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou já finalizado.' });
        }

        const pedido = pedidos[0];
        const valorComissao = parseFloat(pedido.valor_designer || 0);

        // --- TRANSAÇÃO FINANCEIRA (CRÉDITO IMEDIATO) ---
        
        // A) Creditar no saldo do Designer e aumentar contagem de aprovados
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET saldo_disponivel = saldo_disponivel + $1,
                aprovados = aprovados + 1,
                pontuacao = pontuacao + 10 -- Bônus de pontuação
            WHERE designer_id = $2
        `, valorComissao, designerId);

        // B) Atualizar o Pedido: Salvar links, mudar etapa para IMPRESSÃO
        // Nota: 'link_arquivo' é o link final de impressão, 'link_layout' é a prova visual
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'IMPRESSÃO', 
                link_arquivo = $1, 
                link_layout = $2,
                valor_designer_pago = $3,
                updated_at = NOW() 
            WHERE id = $4
        `, linkImpressao, linkLayout, valorComissao, parseInt(pedidoId));

        return res.status(200).json({ 
            success: true, 
            message: `Sucesso! R$ ${valorComissao.toFixed(2).replace('.', ',')} creditados na sua conta.` 
        });

    } catch (error) {
        console.error("Erro ao finalizar pedido:", error);
        return res.status(500).json({ message: 'Erro ao processar finalização do pedido.' });
    }
};
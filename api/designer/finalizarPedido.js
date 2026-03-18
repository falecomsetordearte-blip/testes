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

        // 2. Buscar o pedido (Valor Bruto)
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, valor_designer, titulo 
            FROM pedidos 
            WHERE id = $1 AND designer_id = $2 AND etapa = 'ARTE'
        `, parseInt(pedidoId), designerId);

        if (pedidos.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou já finalizado.' });
        }

        const pedido = pedidos[0];

        // --- CÁLCULO DA COMISSÃO (15%) ---
        const valorBruto = parseFloat(pedido.valor_designer || 0);
        const valorLiquido = valorBruto * 0.85; // Designer recebe 85%

        // A) Creditar valor LÍQUIDO no saldo do Designer
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET saldo_disponivel = saldo_disponivel + $1,
                aprovados = aprovados + 1,
                pontuacao = pontuacao + 10 
            WHERE designer_id = $2
        `, valorLiquido, designerId);

        // B) Atualizar o Pedido
        // Salvamos em 'valor_designer_pago' o que foi efetivamente transferido (o líquido)
        // A coluna 'valor_designer' continua com o Bruto para o histórico da empresa
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'IMPRESSÃO', 
                link_arquivo = $1, 
                link_layout = $2,
                valor_designer_pago = $3, 
                updated_at = NOW() 
            WHERE id = $4
        `, linkImpressao, linkLayout, valorLiquido, parseInt(pedidoId));

        return res.status(200).json({
            success: true,
            message: `Sucesso! R$ ${valorLiquido.toFixed(2).replace('.', ',')} creditados na sua conta (Já descontada taxa de 15%).`
        });

    } catch (error) {
        console.error("Erro ao finalizar pedido:", error);
        return res.status(500).json({ message: 'Erro ao processar finalização do pedido.' });
    }
};
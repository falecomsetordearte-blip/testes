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
        
        // --- SAAS MODEL: ACERTO DE CONTAS DIRETAS ---
        // 1. O designer ganha a pontuação e +1 design aprovado
        // 2. Não há salto adicionado à carteira local. O sistema registra a dívida.
        const valorCombinado = parseFloat(pedido.valor_designer || 0);

        // A) Atualizar Métricas do Designer
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET aprovados = aprovados + 1,
                pontuacao = pontuacao + 10 
            WHERE designer_id = $1
        `, designerId);

        // B) Registrar a Dívida (Acerto de Contas)
        // Busca a empresa dona do pedido
        const pedidosEmpresa = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM pedidos WHERE id = $1
        `, parseInt(pedidoId));
        
        const empresaId = pedidosEmpresa.length > 0 ? pedidosEmpresa[0].empresa_id : null;

        if (empresaId) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO acertos_contas (empresa_id, designer_id, pedido_id, valor, status, criado_em)
                VALUES ($1, $2, $3, $4, 'PENDENTE', NOW())
            `, empresaId, designerId, parseInt(pedidoId), valorCombinado);
        }

        // C) Atualizar o Pedido
        // Salvamos em 'valor_designer_pago' o que a gráfica PROMETEU pagar no PIX (valor cheio).
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'IMPRESSÃO', 
                link_arquivo = $1, 
                link_layout = $2,
                valor_designer_pago = $3, 
                updated_at = NOW() 
            WHERE id = $4
        `, linkImpressao, linkLayout, valorCombinado, parseInt(pedidoId));

        return res.status(200).json({ 
            success: true, 
            message: `Layout enviado com sucesso! Se aprovado, a gráfica fará um PIX de R$ ${valorCombinado.toFixed(2).replace('.', ',')} diretamente para a sua chave.` 
        });

    } catch (error) {
        console.error("Erro ao finalizar pedido:", error);
        return res.status(500).json({ message: 'Erro ao processar finalização do pedido.' });
    }
};
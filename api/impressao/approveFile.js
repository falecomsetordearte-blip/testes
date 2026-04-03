const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId } = req.body;
        if (!dealId) {
            return res.status(400).json({ message: 'ID do Negócio é obrigatório.' });
        }

        console.log(`[approveFile] Iniciando processo de aprovação para o Deal ID: ${dealId}`);

        // --- AÇÃO 1: Buscar os dados do pedido no banco de dados local ---
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, valor_designer, assigned_by_id, etapa 
            FROM pedidos 
            WHERE id = $1 LIMIT 1
        `, parseInt(dealId));

        if (pedidos.length === 0) {
            throw new Error(`Pedido com ID ${dealId} não encontrado no banco de dados local.`);
        }
        
        const pedido = pedidos[0];
        
        // --- AÇÃO 2: Atualizar o status do pedido no banco local ---
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'CONCLUÍDO', 
                status_pagamento_designer = 'PAGO',
                updated_at = NOW()
            WHERE id = $1
        `, pedido.id);
        console.log(`[approveFile] Pedido ${pedido.id} atualizado localmente.`);

        // --- AÇÃO 3: Processar o pagamento do designer ---
        const designerId = pedido.assigned_by_id; // Este campo deve estar preenchido se o designer for local
        const comissao = new Decimal(pedido.valor_designer || 0);
        
        if (designerId && comissao.gt(0)) {
            await prisma.designerFinanceiro.upsert({
                where: { designer_id: parseInt(designerId) },
                update: {
                    saldo_disponivel: {
                        increment: comissao,
                    },
                },
                create: {
                    designer_id: parseInt(designerId),
                    saldo_disponivel: comissao,
                },
            });
            console.log(`[approveFile] SUCESSO: Saldo do designer ID ${designerId} incrementado em ${comissao}.`);
        } else {
            console.warn(`[approveFile] AVISO: Pagamento não processado. Designer ID: ${designerId}, Comissão: ${comissao}.`);
        }

        return res.status(200).json({ success: true, message: 'Arquivo aprovado e pagamento processado localmente!' });

    } catch (error) {
        console.error("[approveFile] Erro no processo de aprovação e pagamento:", error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao aprovar o arquivo. Verifique os logs.' });
    }
};
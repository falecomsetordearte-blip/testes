// /api/webhooks/processarPagamentoDesigner.js - VERSÃO FOCADA APENAS NO SALDO DO DESIGNER

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

/**
 * Encontra um designer pelo ID no banco de dados e incrementa seu saldo disponível.
 * Se o registro financeiro do designer não existir, ele é criado.
 * @param {number} designerId - O ID do designer (ASSIGNED_BY_ID do Bitrix24).
 * @param {Decimal} comissao - O valor da comissão a ser adicionado.
 */
async function atualizarSaldoDesigner(designerId, comissao) {
    // Validação para garantir que temos dados válidos para processar
    if (!designerId || !comissao || !comissao.gt(0)) {
        console.warn(`[AVISO DESIGNER] ID do designer (${designerId}) ou comissão (${comissao}) inválidos. Operação abortada.`);
        return;
    }

    try {
        await prisma.designerFinanceiro.upsert({
            where: { designer_id: designerId },
            update: {
                saldo_disponivel: { increment: comissao },
            },
            create: {
                designer_id: designerId,
                saldo_disponivel: comissao,
            },
        });
        console.log(`[SUCESSO DESIGNER] Saldo do designer ID ${designerId} incrementado em ${comissao}.`);
    } catch (error) {
        console.error(`[ERRO DESIGNER] Falha ao atualizar saldo para o designer ID ${designerId}:`, error.message);
    }
}


// Handler principal do Webhook
module.exports = async (req, res) => {
    try {
        const dealIdString = req.body['document_id[2]']; 
        
        if (!dealIdString) {
            console.warn("[AVISO] Webhook recebido sem 'document_id[2]'.");
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        
        // Buscamos os detalhes do negócio para obter o designer e o valor
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
            console.error(`[ERRO] Negócio com ID ${dealId} não encontrado no Bitrix24.`);
            return res.status(200).send("OK");
        }

        // Extraímos apenas as informações necessárias para o designer
        const designerId = parseInt(deal.ASSIGNED_BY_ID, 10);
        const comissao = new Decimal(deal.OPPORTUNITY || 0);
        
        // Chamamos APENAS a função que atualiza o saldo do designer
        await atualizarSaldoDesigner(designerId, comissao);
        
        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro no webhook de pagamento do designer:", e.response ? e.response.data : e.message);
        res.status(200).send("OK"); // Responde OK para não travar a fila de webhooks do Bitrix
    }
};
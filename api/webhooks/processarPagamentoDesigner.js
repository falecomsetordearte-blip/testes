// /api/webhooks/processarPagamentoDesigner.js
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    try {
        // O Bitrix24 envia os dados no formato 'document_id[2]=DEAL_123'
        const dealId = req.body['document_id'][2].replace('DEAL_', '');
        
        // Buscamos os dados do negócio para saber o responsável e o valor
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
            const deal = dealResponse.data.result;
            
            const designerId = parseInt(deal.ASSIGNED_BY_ID, 10);
            const comissao = new Decimal(deal.OPPORTUNITY || 0);
        
        if (designerId && comissao.gt(0)) {
            // 'upsert' é uma operação segura:
            // - Tenta ATUALIZAR o registro do designer se ele já existir.
            // - Se não existir, ele CRIA um novo registro para o designer.
            await prisma.designerFinanceiro.upsert({
                where: { designer_id: designerId },
                update: {
                    saldo_disponivel: {
                        increment: comissao, // Adiciona o valor ao saldo existente
                    },
                },
                create: {
                    designer_id: designerId,
                    saldo_disponivel: comissao,
                },
            });
            console.log(`[SUCESSO] Saldo do designer ID ${designerId} incrementado em ${comissao}.`);
        } else {
            console.warn(`[AVISO] Webhook recebido para Deal ${dealId}, mas sem designer ou comissão válida.`);
        }
        
        // Responde 200 OK para o Bitrix24 não marcar a automação como falha
        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro no webhook de pagamento do designer:", e);
        // Mesmo em caso de erro, respondemos 200 para não pausar a fila de automação do Bitrix
        res.status(200).send("OK");
    }
}; 

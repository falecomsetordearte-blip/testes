// /api/webhooks/processarPagamentoDesigner.js - VERSÃO FINAL E CORRIGIDA

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    try {
        // --- CORREÇÃO APLICADA AQUI ---
        // Lemos a chave exata que o Bitrix24/Vercel nos envia no corpo da requisição
        const dealIdString = req.body['document_id[2]']; 
        
        if (!dealIdString) {
            console.warn("[AVISO] Webhook recebido, mas a chave 'document_id[2]' não foi encontrada no corpo da requisição.");
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        
        // Buscamos os dados do negócio para saber o responsável e o valor
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;
        
        const designerId = parseInt(deal.ASSIGNED_BY_ID, 10);
        const comissao = new Decimal(deal.OPPORTUNITY || 0);
        
        if (designerId && comissao.gt(0)) {
            // 'upsert' cria ou atualiza o registro do designer de forma segura
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
            console.warn(`[AVISO] Webhook recebido para Deal ${dealId}, mas sem designer ID (${designerId}) ou comissão válida (${comissao}).`);
        }
        
        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro no webhook de pagamento do designer:", e.response ? e.response.data : e.message);
        // Responde 200 para não pausar a fila de automação do Bitrix
        res.status(200).send("OK");
    }
};

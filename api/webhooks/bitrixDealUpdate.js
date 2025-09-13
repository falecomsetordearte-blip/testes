// /api/webhooks/bitrixDealUpdate.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    console.log('[Webhook Início] A API /api/webhooks/bitrixDealUpdate foi chamada.');
    console.log(`[Webhook Início] Método da Requisição: ${req.method}`);

    if (req.method !== 'POST') {
        console.warn('[Webhook Aviso] Requisição recebida com método não permitido:', req.method);
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        console.log('[Webhook Body] Corpo da requisição recebido:', JSON.stringify(req.body, null, 2));

        // --- CORREÇÃO APLICADA AQUI ---
        // Acessamos a chave exata que contém o ID do negócio
        const documentIdString = req.body['document_id[2]']; // Ex: "DEAL_55499"
        
        // Extraímos apenas a parte numérica da string
        const dealId = documentIdString ? parseInt(documentIdString.replace('DEAL_', ''), 10) : null;

        console.log(`[Webhook Dados] String do Document ID[2] extraída: ${documentIdString}`);
        console.log(`[Webhook Dados] ID do Negócio extraído: ${dealId}`);
        
        if (!dealId) {
            console.error('[Webhook Erro] Não foi possível extrair o ID do negócio (dealId) do corpo da requisição.');
            return res.status(200).send('OK - No Deal ID');
        }

        const axios = require('axios');
        const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

        console.log(`[Webhook Ação] Buscando detalhes do negócio ID: ${dealId}`);
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, { id: dealId });
        const deal = dealResponse.data.result;

        if (deal) {
            const designerId = parseInt(deal.ASSIGNED_BY_ID, 10);
            const valorSaque = parseFloat(deal.OPPORTUNITY);

            console.log(`[Webhook Ação] Designer ID: ${designerId}, Valor do Saque: R$ ${valorSaque}`);

            if (designerId && valorSaque > 0) {
                console.log(`[Webhook Ação] Tentando atualizar o saldo pendente do designer ${designerId}...`);
                await prisma.designerFinanceiro.update({
                    where: { designer_id: designerId },
                    data: {
                        saldo_pendente: {
                            decrement: valorSaque,
                        }
                    }
                });
                
                console.log(`[Webhook Sucesso] Saldo pendente do designer ${designerId} atualizado com sucesso.`);
            } else {
                console.warn('[Webhook Aviso] Designer ID ou Valor do Saque inválidos. Nenhuma atualização no banco de dados foi feita.');
            }
        } else {
            console.error(`[Webhook Erro] Negócio com ID ${dealId} não foi encontrado no Bitrix24.`);
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('Erro crítico no webhook bitrixDealUpdate:', error);
        res.status(200).send('Error processed');
    }
};
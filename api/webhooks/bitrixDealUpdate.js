// /api/webhooks/bitrixDealUpdate.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // --- LOG INICIAL ---
    // Este é o log mais importante. Se ele aparecer, sabemos que o Bitrix24 conseguiu chamar a API.
    console.log('[Webhook Início] A API /api/webhooks/bitrixDealUpdate foi chamada.');
    console.log(`[Webhook Início] Método da Requisição: ${req.method}`);

    if (req.method !== 'POST') {
        console.warn('[Webhook Aviso] Requisição recebida com método não permitido:', req.method);
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        // --- LOG DO CORPO DA REQUISIÇÃO ---
        // Vamos registrar o corpo completo da requisição para ver exatamente o que o Bitrix24 está enviando.
        console.log('[Webhook Body] Corpo da requisição recebido:', JSON.stringify(req.body, null, 2));

        // Os dados de uma regra de automação podem vir em um formato ligeiramente diferente
        // A chave principal é 'document_id', que vem no formato 'DEAL_12345'
        const documentId = req.body.document_id; 
        const dealIdString = documentId ? documentId[2] : null; // Pega o número após 'DEAL_'
        const dealId = dealIdString ? parseInt(dealIdString, 10) : null;

        // --- LOG DOS DADOS EXTRAÍDOS ---
        console.log(`[Webhook Dados] Document ID extraído: ${documentId}`);
        console.log(`[Webhook Dados] ID do Negócio extraído: ${dealId}`);
        
        // Se não conseguirmos extrair um ID de negócio, não há o que fazer.
        if (!dealId) {
            console.error('[Webhook Erro] Não foi possível extrair o ID do negócio (dealId) do corpo da requisição.');
            // Respondemos 200 OK para o Bitrix não tentar reenviar.
            return res.status(200).send('OK - No Deal ID');
        }

        // Como a regra de automação só dispara na coluna "PAGO", já sabemos que a condição foi atendida.
        // Agora, buscamos os detalhes do negócio para obter o valor e o ID do designer.
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
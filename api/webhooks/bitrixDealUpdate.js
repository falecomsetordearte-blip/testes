// /api/webhooks/bitrixDealUpdate.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Apenas o método POST é permitido para webhooks
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        // Os dados do negócio atualizado vêm no corpo da requisição
        const dealId = req.body['fields[ID]'];
        const stageId = req.body['fields[STAGE_ID]'];
        const categoryId = req.body['fields[CATEGORY_ID]'];
        
        // --- CONDIÇÃO PRINCIPAL ---
        // Verificamos se a atualização é de um negócio no pipeline de Saque (31)
        // e se ele foi movido para a etapa "Ganho/Pago" (WON).
        if (categoryId === '31' && stageId === 'C31:WON') {
            
            // Precisamos buscar os detalhes do negócio para pegar o valor e o ID do designer
            // A notificação do webhook não envia todos os campos.
            const axios = require('axios');
            const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

            const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, { id: dealId });
            const deal = dealResponse.data.result;

            if (deal) {
                const designerId = parseInt(deal.ASSIGNED_BY_ID, 10);
                const valorSaque = parseFloat(deal.OPPORTUNITY);

                // Verificamos se temos os dados necessários para a operação
                if (designerId && valorSaque > 0) {
                    
                    // Atualiza o banco de dados usando Prisma
                    await prisma.designerFinanceiro.update({
                        where: {
                            designer_id: designerId,
                        },
                        data: {
                            // Decrementa o valor do saque do saldo pendente
                            saldo_pendente: {
                                decrement: valorSaque,
                            }
                        }
                    });
                    
                    console.log(`[Webhook Sucesso] Saldo pendente do designer ${designerId} atualizado em -R$ ${valorSaque}.`);
                }
            }
        }

        // Responde ao Bitrix24 com sucesso para que ele não tente reenviar o webhook.
        // Isso é feito para TODAS as atualizações de negócio, mesmo as que não nos interessam.
        res.status(200).send('OK');

    } catch (error) {
        console.error('Erro no webhook bitrixDealUpdate:', error);
        // Mesmo em caso de erro, respondemos 200 para evitar loops de retry do Bitrix.
        // O erro já foi logado para análise.
        res.status(200).send('Error processed');
    }
};
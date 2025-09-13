// /api/impressao/updateStatus.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const FIELD_STATUS_IMPRESSAO = 'UF_CRM_1757756651931';
const STATUS_ID_PRONTO = '2663';
const STAGE_ID_ACABAMENTO = 'C17:UC_QA8TN5';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId, statusId } = req.body;

        // --- LOG DE DEPURAÇÃO 1 ---
        console.log(`[updateStatus] Recebida requisição para Deal ID: ${dealId} com Status ID: ${statusId}`);
        
        if (!dealId || !statusId) {
            console.error("[updateStatus] ERRO: ID do Negócio ou ID do Status não fornecidos.");
            return res.status(400).json({ message: 'ID do Negócio e ID do Status são obrigatórios.' });
        }

        // AÇÃO 1: Atualizar o campo de status da impressão
        console.log(`[updateStatus] Ação 1: Atualizando campo de status para ${statusId}...`);
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                [FIELD_STATUS_IMPRESSAO]: statusId
            }
        });
        console.log(`[updateStatus] Ação 1: Campo de status atualizado com sucesso.`);


        // AÇÃO 2: Verificar se é o status "Pronto" para mover o negócio
        if (statusId === STATUS_ID_PRONTO) {
            // --- LOG DE DEPURAÇÃO 2 (CRÍTICO) ---
            console.log(`[updateStatus] CONDIÇÃO ATENDIDA: Status é 'Pronto' (${statusId}). Iniciando Ação 2: Mover para a etapa de Acabamento.`);
            
            await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
                id: dealId,
                fields: {
                    'STAGE_ID': STAGE_ID_ACABAMENTO
                }
            });
            
            console.log(`[updateStatus] Ação 2: Negócio ${dealId} movido para a etapa de Acabamento com sucesso.`);

            const responsePayload = { 
                message: 'Status atualizado e negócio movido para Acabamento!',
                movedToNextStage: true 
            };
            
            // --- LOG DE DEPURAÇÃO 3 ---
            console.log('[updateStatus] Enviando resposta para o frontend:', responsePayload);
            return res.status(200).json(responsePayload);
        }

        // Se a condição 'Pronto' não for atendida, segue o fluxo normal.
        const responsePayload = { 
            message: 'Status atualizado com sucesso!',
            movedToNextStage: false
        };

        // --- LOG DE DEPURAÇÃO 4 ---
        console.log(`[updateStatus] Condição 'Pronto' NÃO atendida. Enviando resposta padrão para o frontend:`, responsePayload);
        return res.status(200).json(responsePayload);

    } catch (error) {
        console.error('[updateStatus] ERRO CRÍTICO no processo:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao atualizar o status.' });
    }
};
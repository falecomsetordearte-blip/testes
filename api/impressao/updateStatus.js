// /api/impressao/updateStatus.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Campo de LISTA de status da impressão
const FIELD_STATUS_IMPRESSAO = 'UF_CRM_1757756651931';

// --- NOVAS CONSTANTES ---
const STATUS_ID_PRONTO = '2663';
const STAGE_ID_ACABAMENTO = 'C17:UC_QA8TN5';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId, statusId } = req.body;
        
        if (!dealId || !statusId) {
            return res.status(400).json({ message: 'ID do Negócio e ID do Status são obrigatórios.' });
        }

        // AÇÃO 1: Atualizar o campo de status da impressão (sempre acontece)
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                [FIELD_STATUS_IMPRESSAO]: statusId
            }
        });

        // --- INÍCIO DA NOVA LÓGICA ---
        // AÇÃO 2: Se o status for "Pronto", mover o negócio para a etapa de Acabamento
        if (statusId === STATUS_ID_PRONTO) {
            console.log(`[updateStatus] Status 'Pronto' detectado para o Deal ${dealId}. Movendo para a etapa de Acabamento...`);
            await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
                id: dealId,
                fields: {
                    'STAGE_ID': STAGE_ID_ACABAMENTO
                }
            });
            
            // Retorna uma resposta especial para o frontend saber que o negócio foi movido
            return res.status(200).json({ 
                message: 'Status atualizado e negócio movido para Acabamento!',
                movedToNextStage: true 
            });
        }
        // --- FIM DA NOVA LÓGICA ---

        // Se não for "Pronto", retorna a resposta padrão
        return res.status(200).json({ 
            message: 'Status atualizado com sucesso!',
            movedToNextStage: false
        });

    } catch (error) {
        console.error('Erro ao atualizar status de impressão:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao atualizar o status.' });
    }
};
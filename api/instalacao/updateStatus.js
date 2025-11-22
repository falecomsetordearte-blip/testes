// /api/instalacao/updateStatus.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

//
// TODO: Substitua pelo ID do seu NOVO campo customizado "Status da Instalação".
//
const FIELD_STATUS_INSTALACAO = 'UF_CRM_NOVO_CAMPO_STATUS_INSTALACAO'; 

//
// TODO: Substitua pelo ID da OPÇÃO "Pronto" dentro do seu novo campo de lista.
//
const STATUS_ID_PRONTO = 'NOVO_ID_PRONTO'; // Ex: '3003'

// Este é o destino final quando o card é marcado como "Pronto"
const STAGE_ID_CONCLUIDO = 'C17:UC_GT7MVB';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId, statusId } = req.body;

        console.log(`[updateStatus Instalação] Recebida requisição para Deal ID: ${dealId} com Status ID: ${statusId}`);
        
        if (!dealId || !statusId) {
            return res.status(400).json({ message: 'ID do Negócio e ID do Status são obrigatórios.' });
        }

        // Ação 1: Atualiza o campo de status da instalação
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                [FIELD_STATUS_INSTALACAO]: statusId
            }
        });
        console.log(`[updateStatus Instalação] Campo de status atualizado com sucesso.`);

        // Ação 2: Se o status for "Pronto", move o negócio para a etapa de concluído
        if (statusId === STATUS_ID_PRONTO) {
            console.log(`[updateStatus Instalação] Status é 'Pronto'. Movendo para a etapa final.`);
            
            await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
                id: dealId,
                fields: { 'STAGE_ID': STAGE_ID_CONCLUIDO }
            });
            
            console.log(`[updateStatus Instalação] Negócio ${dealId} movido para a etapa ${STAGE_ID_CONCLUIDO}.`);

            return res.status(200).json({ 
                message: 'Status atualizado e negócio concluído!',
                movedToNextStage: true 
            });
        }

        // Se não for "Pronto", apenas retorna sucesso da atualização do status
        return res.status(200).json({ 
            message: 'Status atualizado com sucesso!',
            movedToNextStage: false
        });

    } catch (error) {
        console.error('[updateStatus Instalação] ERRO CRÍTICO:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao atualizar o status da instalação.' });
    }
};
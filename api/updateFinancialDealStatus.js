// /api/updateFinancialDealStatus.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos status para os STAGE_IDs corretos
const STATUS_MAP = {
    PAGO: 'C11:UC_4SNWR7',
    DEVEDOR: 'C11:UC_W0DCSV'
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId, status } = req.body;

        if (!dealId || !status) {
            return res.status(400).json({ message: 'dealId e status são obrigatórios.' });
        }

        const newStageId = STATUS_MAP[status.toUpperCase()];

        if (!newStageId) {
            return res.status(400).json({ message: 'Status inválido. Use "PAGO" ou "DEVEDOR".' });
        }

        // ETAPA 1: Atualizar o negócio no Bitrix24
        const updateResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
            id: dealId,
            fields: {
                'STAGE_ID': newStageId
            }
        });

        if (!updateResponse.data.result) {
            throw new Error('Falha ao atualizar a etapa do negócio no Bitrix24.');
        }

        console.log(`[SUCESSO] Negócio ${dealId} movido para a etapa ${newStageId}.`);
        return res.status(200).json({ success: true, message: 'Status do negócio atualizado com sucesso.' });

    } catch (error) {
        console.error('Erro ao atualizar status do negócio financeiro:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao atualizar o status.' });
    }
};
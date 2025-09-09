// /api/updateDealStage.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { dealId, newStageId } = req.body;
        if (!dealId || !newStageId) {
            return res.status(400).json({ message: 'dealId e newStageId são obrigatórios.' });
        }

        await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
            id: dealId,
            fields: { 'STAGE_ID': newStageId }
        });

        res.status(200).json({ success: true, message: 'Etapa atualizada com sucesso.' });

    } catch (error) {
        console.error('Erro ao atualizar etapa do negócio:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Ocorreu um erro ao atualizar a etapa.' });
    }
};
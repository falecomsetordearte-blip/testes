// /api/impressao/updateStatus.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Voltamos a usar o campo de LISTA original
const FIELD_STATUS_IMPRESSAO = 'UF_CRM_1757756651931';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId, statusId } = req.body;
        
        if (!dealId || !statusId) {
            return res.status(400).json({ message: 'ID do Negócio e ID do Status são obrigatórios.' });
        }

        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                [FIELD_STATUS_IMPRESSAO]: statusId
            }
        });

        return res.status(200).json({ message: 'Status atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro ao atualizar status de impressão:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao atualizar o status.' });
    }
};
// /api/impressao/requestRevision.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const FIELD_REVISAO_SOLICITADA = 'UF_CRM_1757765731136';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId } = req.body;
        
        if (!dealId) {
            return res.status(400).json({ message: 'ID do Negócio é obrigatório.' });
        }
        
        // No Bitrix24, o valor para "Sim" em um campo Sim/Não é o booleano 'true'
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                [FIELD_REVISAO_SOLICITADA]: true
            }
        });

        return res.status(200).json({ message: 'Solicitação de revisão registrada com sucesso!' });

    } catch (error) {
        console.error('Erro ao solicitar revisão:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao registrar a solicitação.' });
    }
};
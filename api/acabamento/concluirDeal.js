// /api/acabamento/concluirDeal.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const STAGE_ID_CONCLUIDO = 'C17:UC_ZPMNF9'; // Etapa final

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId } = req.body;
        if (!dealId) {
            return res.status(400).json({ message: 'ID do Negócio é obrigatório.' });
        }

        console.log(`[concluirDeal] Recebida requisição para concluir o Deal ID: ${dealId}`);

        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                'STAGE_ID': STAGE_ID_CONCLUIDO
            }
        });

        console.log(`[concluirDeal] Negócio ${dealId} movido para a etapa de Concluído com sucesso.`);

        return res.status(200).json({ message: 'Negócio concluído com sucesso!' });

    } catch (error) {
        console.error(`[concluirDeal] Erro ao concluir o negócio ${req.body.dealId}:`, error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao concluir o negócio.' });
    }
};
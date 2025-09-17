// /api/impressao/getChatHistory.js

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId } = req.body;
        if (!dealId) {
            return res.status(400).json({ message: 'dealId é obrigatório.' });
        }

        const response = await axios.post(`${BITRIX24_API_URL}crm.timeline.comment.list`, {
            filter: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: "deal"
            },
            order: { "CREATED": "ASC" }
        });

        const messages = (response.data.result || []).map(comment => ({
            texto: comment.COMMENT,
            remetente: comment.AUTHOR_ID == 1 ? 'cliente' : 'operador'
        }));

        return res.status(200).json({ messages });

    } catch (error) {
        console.error('Erro em /api/impressao/getChatHistory:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar o histórico do chat.' });
    }
};
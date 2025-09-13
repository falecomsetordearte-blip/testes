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
            return res.status(400).json({ message: 'ID do Negócio é obrigatório.' });
        }

        // 1. Faz a chamada para buscar a lista de comentários de um negócio específico
        const response = await axios.post(`${BITRIX24_API_URL}crm.timeline.comment.list`, {
            filter: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: "deal"
            },
            order: { "CREATED": "ASC" }
        });

        const result = response.data.result || [];
        
        // 2. Garante que os comentários sejam extraídos corretamente, mesmo se vierem em formatos diferentes da API
        let comments = [];
        if (result && Array.isArray(result.items)) {
            comments = result.items;
        } else if (Array.isArray(result)) {
            comments = result;
        }
        
        // 3. Formata as mensagens para o formato que o frontend espera
        const historicoMensagens = comments.map(comment => ({
            texto: comment.COMMENT,
            // Assumindo que o usuário com ID 1 é o operador do sistema
            remetente: comment.AUTHOR_ID == 1 ? 'operador' : 'cliente'
        }));
        
        // 4. Envia o histórico de mensagens formatado de volta para o frontend
        return res.status(200).json({ messages: historicoMensagens });

    } catch (error) {
        console.error(`Erro ao buscar histórico do negócio ${req.body.dealId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar o histórico de mensagens.' });
    }
};
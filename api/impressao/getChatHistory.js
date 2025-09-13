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
        
        // --- LOG DE DEPURAÇÃO 1 ---
        console.log(`[getChatHistory] Iniciando busca de comentários para o dealId: ${dealId}`);

        // 1. Faz a chamada para buscar a lista de comentários
        const response = await axios.post(`${BITRIX24_API_URL}crm.timeline.comment.list`, {
            filter: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: "deal"
            },
            order: { "CREATED": "ASC" }
        });

        // --- LOG DE DEPURAÇÃO 2 ---
        console.log(`[getChatHistory] Resposta recebida da API Bitrix24 para o dealId ${dealId}:`, JSON.stringify(response.data, null, 2));

        const result = response.data.result || [];
        
        // 2. Garante que os comentários sejam extraídos corretamente
        let comments = [];
        if (result && Array.isArray(result.items)) {
            comments = result.items;
        } else if (Array.isArray(result)) {
            comments = result;
        }
        
        // 3. Formata as mensagens
        const historicoMensagens = comments.map(comment => ({
            texto: comment.COMMENT,
            remetente: comment.AUTHOR_ID == 1 ? 'operador' : 'cliente'
        }));
        
        // --- LOG DE DEPURAÇÃO 3 ---
        console.log(`[getChatHistory] Enviando ${historicoMensagens.length} mensagens formatadas para o frontend.`);

        // 4. Envia o histórico de mensagens formatado
        return res.status(200).json({ messages: historicoMensagens });

    } catch (error) {
        console.error(`[getChatHistory] Erro ao buscar histórico do negócio ${req.body.dealId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar o histórico de mensagens.' });
    }
};
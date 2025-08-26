// /api/sendMessage.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// IMPORTANTE: ID do usuário no Bitrix24 que aparecerá como autor das mensagens do cliente.
// Geralmente, o ID 1 é o administrador principal que criou o webhook.
const SYSTEM_AUTHOR_ID = 1; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId, message } = req.body;
        if (!sessionToken || !dealId || !message) {
            return res.status(400).json({ message: 'Token, ID do pedido e mensagem são obrigatórios.' });
        }

        // Validação de segurança (igual às outras funções)
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        const user = userSearch.data.result[0];

        const dealGetResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealGetResponse.data.result;

        if (!user || !deal || deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }

        // Formata a mensagem para ser postada no Bitrix24
        const formattedComment = `[Mensagem do Cliente]\n--------------------\n${message}`;

        // Posta o comentário na timeline do negócio
        await axios.post(`${BITRIX24_API_URL}crm.timeline.comment.add`, {
            fields: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: 'deal',
                COMMENT: formattedComment,
                AUTHOR_ID: SYSTEM_AUTHOR_ID // Faz a postagem em nome do usuário do sistema
            }
        });

        return res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
    }
};

// /api/sendMessage.js - VERSÃO SEGURA E CORRIGIDA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const AUTHOR_ID = 1; // ID do usuário do Bitrix que postará o comentário (ex: Admin/Sistema)

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId, message } = req.body;

        // ETAPA 1: VALIDAR ENTRADAS
        if (!sessionToken || !dealId || !message) {
            return res.status(400).json({ message: 'Token, ID do pedido e mensagem são obrigatórios.' });
        }

        // ETAPA 2: VALIDAR O TOKEN E ENCONTRAR A EMPRESA DO USUÁRIO
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }
        const userCompanyId = user.COMPANY_ID;
        
        // ETAPA 3: VERIFICAR SE O NEGÓCIO PERTENCE À EMPRESA DO USUÁRIO
        const dealGetResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealGetResponse.data.result;

        // Verificação de segurança crucial:
        if (!deal || deal.COMPANY_ID != userCompanyId) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para comentar neste pedido.' });
        }
        
        // ETAPA 4: SE A VERIFICAÇÃO PASSOU, ENVIAR A MENSAGEM
        // A formatação da mensagem foi ajustada para indicar que vem do cliente
        const formattedComment = `[Mensagem do Cliente]\n--------------------\n${message}`;

        await axios.post(`${BITRIX24_API_URL}crm.timeline.comment.add`, {
            fields: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: 'deal',
                COMMENT: formattedComment,
                AUTHOR_ID: AUTHOR_ID // ID do autor do comentário (Sistema)
            }
        });

        return res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
    }
};
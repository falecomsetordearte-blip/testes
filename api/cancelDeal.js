// /api/cancelDeal.js - CÓDIGO COMPLETO (NENHUMA ALTERAÇÃO NECESSÁRIA)

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId } = req.body;
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Token e ID do pedido são obrigatórios.' });
        }

        // ETAPA 1: Validar o token de sessão e obter o COMPANY_ID do usuário
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }
        
        // ETAPA 2: Buscar o negócio para garantir que pertence ao usuário
        const dealGetResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealGetResponse.data.result;

        // Validação de segurança
        if (!deal || deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado a este pedido.' });
        }

        // ETAPA 3: Atualizar a etapa (stage) do negócio para LOSE
        const updateResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
            id: dealId,
            fields: { 
                'STAGE_ID': 'C17:LOSE'
            }
        });

        if (!updateResponse.data.result) {
            throw new Error('Falha ao atualizar o pedido no Bitrix24.');
        }

        return res.status(200).json({ success: true, message: 'Pedido cancelado com sucesso!' });

    } catch (error) {
        console.error('Erro ao cancelar pedido:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
    }
};
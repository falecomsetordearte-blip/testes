// /api/createDeal.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados para facilitar a leitura
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { 
            sessionToken,
            titulo,
            valorDesigner,
            nomeCliente,
            wppCliente,
            briefingFormatado // Receberemos o briefing já formatado do frontend
        } = req.body;

        if (!sessionToken || !titulo || !valorDesigner || !nomeCliente || !wppCliente || !briefingFormatado) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
        }

        // ETAPA 1: Encontrar o contato e a company pelo token de sessão
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }

        const companyId = user.COMPANY_ID;

        // ETAPA 2: Preparar os campos para a criação do Negócio (Deal)
        
        // Calcular Opportunity: valor do designer - 10%
        const opportunityValue = parseFloat(valorDesigner) * 0.9;

        const dealFields = {
            'TITLE': titulo,
            'OPPORTUNITY': opportunityValue.toFixed(2),
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': companyId,
            'CATEGORY_ID': 17, // Pipeline 17
            'STAGE_ID': 'C17:NEW', // Etapa inicial do Pipeline 17
            [FIELD_BRIEFING_COMPLETO]: briefingFormatado,
            [FIELD_NOME_CLIENTE]: nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: wppCliente,
        };

        // ETAPA 3: Criar o Negócio no Bitrix24
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });
        
        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            throw new Error('Falha ao criar o negócio no Bitrix24.');
        }

        // ETAPA FINAL: Enviar resposta de sucesso
        return res.status(200).json({ 
            success: true, 
            message: 'Negócio criado com sucesso!',
            dealId: newDealId 
        });

    } catch (error) {
        console.error('Erro ao criar negócio:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno ao criar o pedido.' });
    }
};

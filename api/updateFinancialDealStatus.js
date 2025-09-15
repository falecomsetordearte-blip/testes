// /api/updateFinancialDealStatus.js - VERSÃO SEGURA E CORRIGIDA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos status para os STAGE_IDs corretos
const STATUS_MAP = {
    PAGO: 'C11:UC_4SNWR7',
    DEVEDOR: 'C11:UC_W0DCSV'
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, dealId, status } = req.body;

        // ETAPA 1: VALIDAR ENTRADAS
        if (!sessionToken || !dealId || !status) {
            return res.status(400).json({ message: 'Token, dealId e status são obrigatórios.' });
        }

        const newStageId = STATUS_MAP[status.toUpperCase()];
        if (!newStageId) {
            return res.status(400).json({ message: 'Status inválido. Use "PAGO" ou "DEVEDOR".' });
        }

        // ETAPA 2: VALIDAR O TOKEN E ENCONTRAR A EMPRESA DO USUÁRIO
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }
        
        // ETAPA 3: VERIFICAR SE O NEGÓCIO A SER ATUALIZADO PERTENCE À EMPRESA DO USUÁRIO
        const dealGetResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealGetResponse.data.result;

        if (!deal) {
            return res.status(404).json({ message: 'Negócio não encontrado.' });
        }
        
        if (deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para modificar este negócio.' });
        }

        // ETAPA 4: SE A VERIFICAÇÃO PASSOU, ATUALIZAR O NEGÓCIO
        const updateResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
            id: dealId,
            fields: {
                'STAGE_ID': newStageId
            }
        });

        if (!updateResponse.data.result) {
            throw new Error('Falha ao atualizar a etapa do negócio no Bitrix24.');
        }

        console.log(`[SUCESSO] Negócio ${dealId} da empresa ${user.COMPANY_ID} movido para a etapa ${newStageId}.`);
        return res.status(200).json({ success: true, message: 'Status do negócio atualizado com sucesso.' });

    } catch (error) {
        console.error('Erro ao atualizar status do negócio financeiro:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao atualizar o status.' });
    }
};
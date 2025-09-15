// /api/acabamento/concluirDeal.js - VERSÃO SEGURA E CORRIGIDA

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const STAGE_ID_CONCLUIDO = 'C17:UC_ZPMNF9'; // Etapa final

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, dealId } = req.body;

        // ETAPA 1: VALIDAR ENTRADAS
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Token de sessão e ID do Negócio são obrigatórios.' });
        }

        // ETAPA 2: ENCONTRAR O USUÁRIO E SUA EMPRESA PELO TOKEN
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }
        const userCompanyId = user.COMPANY_ID;

        // ETAPA 3: VERIFICAR SE O NEGÓCIO A SER CONCLUÍDO PERTENCE À EMPRESA DO USUÁRIO
        console.log(`[concluirDeal] Verificando posse do Deal ID: ${dealId} para a Empresa ID: ${userCompanyId}`);
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, { id: dealId });
        
        const deal = dealResponse.data.result;
        if (!deal) {
            return res.status(404).json({ message: 'Negócio não encontrado.' });
        }
        
        // Verificação crucial de segurança:
        if (deal.COMPANY_ID != userCompanyId) {
            console.warn(`[ALERTA DE SEGURANÇA] Tentativa de concluir o negócio ${dealId} (Empresa ${deal.COMPANY_ID}) pelo usuário da empresa ${userCompanyId}. Acesso negado.`);
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para modificar este negócio.' });
        }

        // ETAPA 4: SE A VERIFICAÇÃO PASSOU, ATUALIZAR O NEGÓCIO
        console.log(`[concluirDeal] Permissão concedida. Movendo o Deal ID: ${dealId} para a etapa Concluído.`);
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                'STAGE_ID': STAGE_ID_CONCLUIDO
            }
        });

        console.log(`[concluirDeal] Negócio ${dealId} movido com sucesso.`);
        return res.status(200).json({ message: 'Negócio concluído com sucesso!' });

    } catch (error) {
        console.error(`[concluirDeal] Erro ao concluir o negócio ${req.body.dealId}:`, error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao concluir o negócio.' });
    }
};
// /api/acabamento/getDeals.js - VERSÃO COM CORREÇÃO DO TYPO

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento de campos (Aqui o nome estava correto)
const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_STATUS_IMPRESSAO = 'UF_CRM_1757756651931';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_CONTATO_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_LINK_ATENDIMENTO = 'UF_CRM_1752712769666';
const FIELD_MEDIDAS = 'UF_CRM_1727464924690';
const FIELD_LINK_ARQUIVO_FINAL = 'UF_CRM_1748277308731';
const FIELD_REVISAO_SOLICITADA = 'UF_CRM_1757765731136'; // <- Nome correto da variável
const FIELD_STATUS_PAGAMENTO_DESIGNER = 'UF_CRM_1757789502613';
const FIELD_PRAZO_FINAL = 'UF_CRM_1757794109';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;

        if (!sessionToken) {
            return res.status(401).json({ message: 'Acesso não autorizado. Token de sessão é obrigatório.' });
        }

        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }

        const filterParams = {
            'STAGE_ID': 'C17:UC_QA8TN5',
            'COMPANY_ID': user.COMPANY_ID
        };

        if (impressoraFilter) filterParams[FIELD_IMPRESSORA] = impressoraFilter;
        if (materialFilter) filterParams[FIELD_MATERIAL] = materialFilter;

        console.log('[getAcabamentoDeals] Iniciando busca de negócios com os filtros:', JSON.stringify(filterParams));

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: [
                'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID',
                FIELD_STATUS_IMPRESSAO, FIELD_NOME_CLIENTE, FIELD_CONTATO_CLIENTE,
                FIELD_LINK_ATENDIMENTO, FIELD_MEDIDAS, FIELD_LINK_ARQUIVO_FINAL,
                // --- CORREÇÃO APLICADA AQUI ---
                FIELD_REVISAO_SOLICITADA, // Estava "FIELD_REVISAO_SOLICITA"
                // --- FIM DA CORREÇÃO ---
                FIELD_STATUS_PAGAMENTO_DESIGNER,
                FIELD_PRAZO_FINAL
            ]
        });

        const deals = response.data.result || [];
        
        console.log(`[getAcabamentoDeals] ${deals.length} negócios encontrados para a empresa ${user.COMPANY_ID}. Enviando para o frontend.`);
        
        return res.status(200).json({ deals: deals });

    } catch (error) {
        // Agora o erro será mais específico se houver outro problema
        console.error('[getAcabamentoDeals] Erro ao buscar negócios de acabamento:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
// /api/impressao/getDeals.js

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Lista completa de todos os campos que o painel-script.js precisa
const REQUIRED_FIELDS = [
    'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID',
    'UF_CRM_1757756651931', // STATUS_IMPRESSAO_FIELD
    'UF_CRM_1741273407628', // NOME_CLIENTE_FIELD
    'UF_CRM_1749481565243', // CONTATO_CLIENTE_FIELD
    'UF_CRM_1752712769666', // LINK_ATENDIMENTO_FIELD
    'UF_CRM_1727464924690', // MEDIDAS_FIELD
    'UF_CRM_1748277308731', // LINK_ARQUIVO_FINAL_FIELD
    'UF_CRM_1757765731136', // REVISAO_SOLICITADA_FIELD
    'UF_CRM_1757789502613', // FIELD_STATUS_PAGAMENTO_DESIGNER
    'UF_CRM_1757794109'      // PRAZO_FINAL_FIELD
];

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { impressoraFilter, materialFilter } = req.body;

        const filterParams = { 'CATEGORY_ID': 23, '!STAGE_ID': ['C23:WON', 'C23:LOSE'] };
        if (impressoraFilter) filterParams['UF_CRM_1658470569'] = impressoraFilter;
        if (materialFilter) filterParams['UF_CRM_1685624742'] = materialFilter;

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: REQUIRED_FIELDS
        });

        const deals = response.data.result || [];
        return res.status(200).json({ deals });

    } catch (error) {
        console.error('Erro em /api/impressao/getDeals:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados de produção.' });
    }
};
// /api/impressao/getDeals.js

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const REQUIRED_FIELDS = [
    'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID',
    'UF_CRM_1757756651931', 'UF_CRM_1741273407628', 'UF_CRM_1749481565243',
    'UF_CRM_1752712769666', 'UF_CRM_1727464924690', 'UF_CRM_1748277308731',
    'UF_CRM_1757765731136', 'UF_CRM_1757789502613', 'UF_CRM_1757794109'
];

module.exports = async (req, res) => {
    console.log('[getDeals Impressao] Recebida requisição para buscar negócios.');
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { impressoraFilter, materialFilter } = req.body;
        console.log(`[getDeals Impressao] Filtros aplicados: Impressora=${impressoraFilter || 'Nenhum'}, Material=${materialFilter || 'Nenhum'}`);

        const filterParams = { 'CATEGORY_ID': 23, '!STAGE_ID': ['C23:WON', 'C23:LOSE'] };
        if (impressoraFilter) filterParams['UF_CRM_1658470569'] = impressoraFilter;
        if (materialFilter) filterParams['UF_CRM_1685624742'] = materialFilter;

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: REQUIRED_FIELDS
        });

        const deals = response.data.result || [];
        console.log(`[getDeals Impressao] ${deals.length} negócios encontrados. Enviando para o frontend.`);
        return res.status(200).json({ deals });

    } catch (error) {
        console.error('[getDeals Impressao] Erro:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados de produção.' });
    }
};
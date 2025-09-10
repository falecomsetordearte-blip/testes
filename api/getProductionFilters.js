// /api/getProductionFilters.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const response = await axios.get(`${BITRIX24_API_URL}crm.deal.fields.json`);
        const allFields = response.data.result;

        const impressoraOptions = allFields[FIELD_IMPRESSORA]?.items || [];
        const materialOptions = allFields[FIELD_MATERIAL]?.items || [];

        const filters = {
            impressoras: impressoraOptions.map(item => ({ id: item.ID, value: item.VALUE })),
            materiais: materialOptions.map(item => ({ id: item.ID, value: item.VALUE }))
        };

        return res.status(200).json(filters);

    } catch (error) {
        console.error('Erro ao buscar opções de filtros:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os filtros.' });
    }
};
// /api/getProductionDeals.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados para clareza
const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';
// IMPORTANTE: Crie um campo "Data" para o prazo e coloque o ID aqui
const FIELD_PRAZO_PRODUCAO = 'UF_CRM_PRAZO_PRODUCAO'; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { impressoraFilter, materialFilter } = req.body;

        // ETAPA 1: Construir o filtro dinamicamente
        const filterParams = {
            'CATEGORY_ID': 23, // Apenas pipeline de Produção
        };

        if (impressoraFilter) {
            filterParams[FIELD_IMPRESSORA] = impressoraFilter;
        }
        if (materialFilter) {
            filterParams[FIELD_MATERIAL] = materialFilter;
        }

        // ETAPA 2: Buscar todos os negócios que correspondem ao filtro
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { [FIELD_PRAZO_PRODUCAO]: 'ASC' }, // Ordena pelos prazos mais próximos
            select: [
                'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID',
                FIELD_PRAZO_PRODUCAO,
                FIELD_IMPRESSORA,
                FIELD_MATERIAL
            ]
        });
        
        // NOTA: Para buscar os nomes dos responsáveis, precisaríamos de uma lógica adicional aqui
        // como fizemos no painel de vendas. Por enquanto, retornaremos os IDs.

        const deals = response.data.result || [];

        return res.status(200).json({ deals });

    } catch (error) {
        console.error('Erro ao buscar negócios de produção:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
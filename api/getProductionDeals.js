// /api/getProductionDeals.js - VERSÃO ATUALIZADA PARA MODAL

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados
const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_PRAZO_IMPRESSAO_MINUTOS = 'UF_CRM_1757466402085'; // Prazo em minutos
const FIELD_LINK_VER_PEDIDO = 'UF_CRM_1741349861326'; // Link externo
const FIELD_LINK_ARQUIVO_FINAL = 'UF_CRM_1748277308731'; // Link de download

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { impressoraFilter, materialFilter } = req.body;

        const filterParams = { 'CATEGORY_ID': 23 };
        if (impressoraFilter) filterParams[FIELD_IMPRESSORA] = impressoraFilter;
        if (materialFilter) filterParams[FIELD_MATERIAL] = materialFilter;

        // Buscamos todos os negócios que correspondem ao filtro
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: [
                'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID', 'DATE_CREATE',
                FIELD_PRAZO_IMPRESSAO_MINUTOS,
                FIELD_LINK_VER_PEDIDO,
                FIELD_LINK_ARQUIVO_FINAL
            ]
        });

        const deals = response.data.result || [];
        
        // Para cada negócio, buscamos seu histórico de chat
        const chatCommands = deals.map(deal => 
            `crm.timeline.comment.list?` + new URLSearchParams({
                filter: { ENTITY_ID: deal.ID, ENTITY_TYPE: "deal" },
                order: { "CREATED": "ASC" }
            })
        );
        
        let chatHistories = {};
        if (chatCommands.length > 0) {
            const chatResponse = await axios.post(`${BITRIX24_API_URL}batch`, { cmd: chatCommands });
            const chatResults = chatResponse.data.result.result;
            deals.forEach((deal, index) => {
                chatHistories[deal.ID] = (chatResults[index] || []).map(comment => ({
                    texto: comment.COMMENT,
                    remetente: comment.AUTHOR_ID == 1 ? 'cliente' : 'designer' // Assumindo autor 1 = sistema/cliente
                }));
            });
        }
        
        // Adiciona o histórico de chat a cada deal
        const dealsWithChat = deals.map(deal => ({
            ...deal,
            historicoMensagens: chatHistories[deal.ID] || []
        }));

        return res.status(200).json({ deals: dealsWithChat });

    } catch (error) {
        console.error('Erro ao buscar negócios de produção:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
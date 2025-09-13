// /api/impressao/getDeals.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados
const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_PRAZO_IMPRESSAO_MINUTOS = 'UF_CRM_17577566402085';
const FIELD_STATUS_IMPRESSAO = 'UF_CRM_1757756651931';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_CONTATO_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_LINK_ATENDIMENTO = 'UF_CRM_1752712769666';
const FIELD_MEDIDAS = 'UF_CRM_1727464924690';
const FIELD_LINK_ARQUIVO_FINAL = 'UF_CRM_1748277308731';
const FIELD_REVISAO_SOLICITADA = 'UF_CRM_1757765731136'; // <-- CAMPO ADICIONADO

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { impressoraFilter, materialFilter } = req.body;
        const filterParams = { 'STAGE_ID': 'C17:UC_ZHMX6W' };

        if (impressoraFilter) filterParams[FIELD_IMPRESSORA] = impressoraFilter;
        if (materialFilter) filterParams[FIELD_MATERIAL] = materialFilter;

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: [
                'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID', 'DATE_CREATE',
                FIELD_PRAZO_IMPRESSAO_MINUTOS,
                FIELD_STATUS_IMPRESSAO,
                FIELD_NOME_CLIENTE,
                FIELD_CONTATO_CLIENTE,
                FIELD_LINK_ATENDIMENTO,
                FIELD_MEDIDAS,
                FIELD_LINK_ARQUIVO_FINAL,
                FIELD_REVISAO_SOLICITADA // <-- CAMPO ADICIONADO
            ]
        });

        const deals = response.data.result || [];
        
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
                    remetente: comment.AUTHOR_ID == 1 ? 'cliente' : 'designer'
                }));
            });
        }
        
        const dealsWithChat = deals.map(deal => ({
            ...deal,
            historicoMensagens: chatHistories[deal.ID] || []
        }));

        return res.status(200).json({ deals: dealsWithChat });

    } catch (error) {
        console.error('Erro ao buscar negócios de impressão:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
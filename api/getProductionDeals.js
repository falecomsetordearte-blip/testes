// /api/getProductionDeals.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_PRAZO_IMPRESSAO_MINUTOS = 'UF_CRM_1757466402085';
const FIELD_LINK_VER_PEDIDO = 'UF_CRM_1741349861326';
const FIELD_LINK_ARQUIVO_FINAL = 'UF_CRM_1748277308731';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;

        const filterParams = { 'CATEGORY_ID': 23 };
        if (materialFilter) filterParams[FIELD_MATERIAL] = materialFilter;
        // Não filtramos mais a impressora via Bitrix, pois agora é no banco local

        let empresaId = null;
        if (sessionToken) {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (empresas.length > 0) empresaId = empresas[0].id;
            else {
                const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
                if (users.length > 0) empresaId = users[0].empresa_id;
            }
        }

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

        let deals = response.data.result || [];

        // Integrando base local PostgreSQL para referências das impressoras
        if (empresaId && deals.length > 0) {
            const dealIds = deals.map(d => parseInt(d.ID));

            // Pega todo o binding de impressoras do postgres p/ essa empresa
            const pedidosPg = await prisma.$queryRawUnsafe(`
                SELECT bitrix_deal_id, impressoras_ids 
                FROM pedidos 
                WHERE empresa_id = $1 AND bitrix_deal_id = ANY($2::int[])
            `, empresaId, dealIds);

            // Mapeando por deal id
            const mapPedidos = {};
            pedidosPg.forEach(p => {
                mapPedidos[p.bitrix_deal_id] = p.impressoras_ids || [];
            });

            // Mesclando no objeto do deal
            deals = deals.map(deal => ({
                ...deal,
                impressoras_ids: mapPedidos[parseInt(deal.ID)] || []
            }));
        }

        // Se tiver filtro local de Impressora
        if (impressoraFilter && impressoraFilter !== 'cadastrar') {
            deals = deals.filter(deal => {
                if (!deal.impressoras_ids) return false;
                // deal.impressoras_ids pode ser array de num ou str
                return deal.impressoras_ids.map(String).includes(String(impressoraFilter));
            });
        }
        
        // Para cada negócio, buscamos seu histórico de chat
        const chatCommands = deals.map(deal => 
            `crm.timeline.comment.list?` + new URLSearchParams({
                filter: { ENTITY_ID: deal.ID, ENTITY_TYPE: "deal" },
                order: { "CREATED": "ASC" }
            })
        );
        
        let chatHistories = {};
        if (chatCommands.length > 0) {
            const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
            const commandChunks = chunkArray(chatCommands, 50);
            
            let allChatResults = [];
            for (let chunk of commandChunks) {
                const chatResponse = await axios.post(`${BITRIX24_API_URL}batch`, { cmd: chunk });
                const chatResults = chatResponse.data.result.result;
                allChatResults = allChatResults.concat(Object.values(chatResults));
            }
            
            deals.forEach((deal, index) => {
                chatHistories[deal.ID] = (allChatResults[index] || []).map(comment => ({
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
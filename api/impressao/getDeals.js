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
const FIELD_REVISAO_SOLICITADA = 'UF_CRM_1757765731136';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { impressoraFilter, materialFilter } = req.body;
        const filterParams = { 'STAGE_ID': 'C17:UC_ZHMX6W' };

        if (impressoraFilter) filterParams[FIELD_IMPRESSORA] = impressoraFilter;
        if (materialFilter) filterParams[FIELD_MATERIAL] = materialFilter;

        // 1. Buscar a lista de negócios
        console.log('Buscando negócios de impressão...');
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: [
                'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID', 'DATE_CREATE',
                FIELD_PRAZO_IMPRESSAO_MINUTOS, FIELD_STATUS_IMPRESSAO,
                FIELD_NOME_CLIENTE, FIELD_CONTATO_CLIENTE, FIELD_LINK_ATENDIMENTO,
                FIELD_MEDIDAS, FIELD_LINK_ARQUIVO_FINAL, FIELD_REVISAO_SOLICITADA
            ]
        });

        const deals = response.data.result || [];
        if (deals.length === 0) {
            console.log('Nenhum negócio encontrado com os filtros aplicados.');
            return res.status(200).json({ deals: [] });
        }
        console.log(`Encontrados ${deals.length} negócios. Buscando comentários...`);

        // 2. Montar um lote de comandos para buscar o histórico de chat de todos os negócios de uma vez
        const chatCommands = deals.map(deal =>
            `crm.timeline.comment.list?` + new URLSearchParams({
                filter: { ENTITY_ID: deal.ID, ENTITY_TYPE: "deal" },
                order: { "CREATED": "ASC" }
            })
        );
        
        const chatResponse = await axios.post(`${BITRIX24_API_URL}batch`, { cmd: chatCommands });

        // --- INÍCIO DA SEÇÃO DE DIAGNÓSTICO E ROBUSTEZ ---

        // Verifica se a resposta do batch veio no formato esperado
        if (!chatResponse.data || !chatResponse.data.result || !chatResponse.data.result.result) {
            console.error('Resposta do batch de comentários está em um formato inesperado:', JSON.stringify(chatResponse.data, null, 2));
            // Mesmo com erro, continua a execução para não quebrar a página, mas os chats ficarão vazios.
        }

        const batchResults = chatResponse.data.result.result || [];

        // Adiciona um log para depuração, mostrando o que foi recebido para o primeiro negócio
        if (deals.length > 0 && batchResults.length > 0) {
             console.log(`Resposta de comentários para o primeiro negócio (ID: ${deals[0].ID}):`, JSON.stringify(batchResults[0], null, 2));
        }
        
        // --- FIM DA SEÇÃO DE DIAGNÓSTICO ---

        // 3. Adicionar o histórico de chat a cada objeto de negócio
        const dealsWithChat = deals.map((deal, index) => {
            // Garante que 'comments' seja sempre um array, mesmo que a resposta do batch falhe para este item
            const comments = batchResults[index] || []; 
            
            const historicoMensagens = comments.map(comment => ({
                texto: comment.COMMENT,
                // ATENÇÃO: Confirme se o ID '1' realmente corresponde ao seu operador/sistema.
                // Em algumas instalações do Bitrix, pode ser um ID de usuário diferente.
                remetente: comment.AUTHOR_ID == 1 ? 'operador' : 'designer'
            }));

            return {
                ...deal,
                historicoMensagens: historicoMensagens
            };
        });

        return res.status(200).json({ deals: dealsWithChat });

    } catch (error) {
        // Log detalhado do erro no servidor
        console.error('Erro detalhado ao buscar negócios de impressão:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
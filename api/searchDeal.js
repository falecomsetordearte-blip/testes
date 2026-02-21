// /api/searchDeal.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

function identificarSetor(stageId, title = '') {
    if (!stageId) return { setor: 'DESCONHECIDO', cor: '#95a5a6' };
    const stage = stageId.toUpperCase();
    const titulo = title.toUpperCase();
    if (['WON', 'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K', 'LOSE'].includes(stage)) return { setor: 'EXPEDIÇÃO / ARQUIVADO', cor: '#2ecc71' };
    if (stage === 'C17:NEW' || stage === 'C17:UC_ZHMX6W' || stage === 'C17:UC_JHF0WH') return { setor: 'ARTE (Novos)', cor: '#3498db' };
    if (titulo.includes('INSTALA') || stage.includes('INSTALL') || stage.includes('EXTERNA') || stage.includes('LOJA')) return { setor: 'INSTALAÇÃO', cor: '#9b59b6' };
    if (stage.includes('PREPARATION') || stage.includes('EXECUTING')) return { setor: 'IMPRESSÃO / ACABAMENTO', cor: '#e67e22' };
    if (!stage.startsWith('C17')) return { setor: 'CRM (Vendas)', cor: '#f1c40f' };
    return { setor: 'EM PRODUÇÃO', cor: '#7f8c8d' };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    
    console.log("--- INÍCIO DA BUSCA ---");
    console.log("Payload recebido:", JSON.stringify(req.body));

    try {
        const { sessionToken, query } = req.body;

        if (!sessionToken || !query) {
            console.error("Erro: Dados ausentes (token ou query)");
            return res.status(400).json({ message: 'Dados insuficientes.' });
        }

        const cleanQuery = query.toString().trim().replace('#', '');
        console.log(`Query Processada: "${cleanQuery}"`);

        // 1. VALIDAR USUÁRIO
        const userCheckPayload = {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'NAME'] 
        };
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, userCheckPayload);
        
        if (!userSearch.data.result || userSearch.data.result.length === 0) {
            console.error("Erro: Sessão inválida. Nenhum contato encontrado com este token.");
            return res.status(401).json({ message: 'Sessão inválida.' });
        }
        console.log(`Usuário autenticado: ${userSearch.data.result[0].NAME} (ID: ${userSearch.data.result[0].ID})`);

        // 2. MONTAR FILTRO DE BUSCA
        // Vamos tentar uma abordagem mais simples primeiro se o Bitrix estiver rejeitando o OR complexo
        let filter = {
            'LOGIC': 'OR',
            'TITLE': `%${cleanQuery}%`, // Contém em qualquer lugar
            'ID': cleanQuery            // Ou o ID é o número
        };

        console.log("Filtro enviado ao Bitrix:", JSON.stringify(filter));

        // 3. EXECUTAR BUSCA NO BITRIX
        let searchResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filter,
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY'],
            order: { 'ID': 'DESC' }
        });

        let deals = searchResponse.data.result || [];
        console.log(`Resultados encontrados na primeira tentativa: ${deals.length}`);

        // 4. FALLBACK: Se não encontrou nada e é número, tenta busca simples só por título
        if (deals.length === 0) {
            console.log("Nenhum resultado com OR. Tentando busca simples por TITLE...");
            const fallbackResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
                filter: { '%TITLE': cleanQuery },
                select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY']
            });
            deals = fallbackResponse.data.result || [];
            console.log(`Resultados na busca de fallback: ${deals.length}`);
        }

        // 5. FORMATAR
        const results = deals.map(deal => {
            const info = identificarSetor(deal.STAGE_ID, deal.TITLE);
            return {
                id: deal.ID,
                titulo: deal.TITLE,
                data: deal.DATE_CREATE,
                valor: deal.OPPORTUNITY,
                setor: info.setor,
                cor_setor: info.cor
            };
        });

        console.log("--- BUSCA FINALIZADA COM SUCESSO ---");
        return res.status(200).json({ results });

    } catch (error) {
        console.error('--- ERRO CRÍTICO NA BUSCA ---');
        if (error.response) {
            console.error('Data do Erro Bitrix:', JSON.stringify(error.response.data));
            console.error('Status do Erro Bitrix:', error.response.status);
        } else {
            console.error('Mensagem de erro:', error.message);
        }
        return res.status(500).json({ message: 'Erro interno na busca.' });
    }
};
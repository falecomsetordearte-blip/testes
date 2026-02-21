// /api/searchDeal.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

function identificarSetor(stageId, title = '') {
    if (!stageId) return { setor: 'DESCONHECIDO', cor: '#95a5a6' };
    const stage = stageId.toUpperCase();
    const titulo = title.toUpperCase();

    // Log para depurar o estágio real que vem do Bitrix
    // console.log(`DEBUG SETOR: Titulo: ${titulo} | StageID: ${stage}`);

    if (['WON', 'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K', 'LOSE'].includes(stage)) return { setor: 'EXPEDIÇÃO / ARQUIVADO', cor: '#2ecc71' };
    if (stage === 'C17:NEW' || stage === 'C17:UC_ZHMX6W' || stage === 'C17:UC_JHF0WH') return { setor: 'ARTE (Novos)', cor: '#3498db' };
    
    // Verificando Impressão/Acabamento (Aqui pode estar o erro de mapeamento)
    if (stage.includes('PREPARATION') || stage.includes('EXECUTING') || stage.includes('UC_487F6S')) { // Adicionei um exemplo de ID comum
        return { setor: 'IMPRESSÃO / ACABAMENTO', cor: '#e67e22' };
    }
    
    if (titulo.includes('INSTALA') || stage.includes('INSTALL') || stage.includes('EXTERNA') || stage.includes('LOJA')) return { setor: 'INSTALAÇÃO', cor: '#9b59b6' };
    
    if (!stage.startsWith('C17')) return { setor: 'CRM (Vendas)', cor: '#f1c40f' };
    
    return { setor: 'EM PRODUÇÃO', cor: '#7f8c8d' };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, query } = req.body;
        const cleanQuery = query.toString().trim().replace('#', '');

        // 1. BUSCAR USUÁRIO (Omitido logs aqui para focar no resultado)
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'NAME'] 
        });
        if (!userSearch.data.result?.length) return res.status(401).json({ message: 'Sessão inválida.' });

        // 2. BUSCA CORRIGIDA (Operador % na chave)
        console.log(`--- PESQUISANDO POR: "${cleanQuery}" ---`);
        const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: {
                'LOGIC': 'OR',
                '%TITLE': cleanQuery, // AGORA ESTÁ CORRETO
                'ID': cleanQuery      // Busca por ID exato
            },
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY'],
            order: { 'ID': 'DESC' }
        });

        const deals = searchResponse.data.result || [];
        console.log(`Quantidade de negócios encontrados: ${deals.length}`);

        // 3. LOG DETALHADO DOS RESULTADOS PARA DEPURAÇÃO
        deals.forEach((d, index) => {
            console.log(`[Resultado ${index + 1}] ID: ${d.ID} | Título: ${d.TITLE} | StageID: ${d.STAGE_ID}`);
        });

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

        return res.status(200).json({ results });

    } catch (error) {
        console.error('Erro na busca:', error.message);
        return res.status(500).json({ message: 'Erro interno.' });
    }
};
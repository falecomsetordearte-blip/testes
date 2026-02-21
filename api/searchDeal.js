// /api/searchDeal.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

function identificarSetor(stageId, title = '') {
    if (!stageId) return { setor: 'DESCONHECIDO', cor: '#95a5a6' };
    const stage = stageId.toUpperCase();
    const titulo = title.toUpperCase();

    // 1. EXPEDIÇÃO / FINALIZADOS
    if (['WON', 'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K', 'LOSE'].includes(stage)) return { setor: 'EXPEDIÇÃO / ARQUIVADO', cor: '#2ecc71' };
    
    // 2. ARTE
    if (stage === 'C17:NEW' || stage === 'C17:UC_ZHMX6W' || stage === 'C17:UC_JHF0WH') return { setor: 'ARTE (Novos)', cor: '#3498db' };
    
    // 3. IMPRESSÃO / ACABAMENTO 
    // OBS: Aqui vamos conferir nos logs se o seu Bitrix usa IDs diferentes para Impressão
    if (stage.includes('PREPARATION') || stage.includes('EXECUTING') || stage.includes('UC_487F6S')) {
        return { setor: 'IMPRESSÃO / ACABAMENTO', cor: '#e67e22' };
    }
    
    // 4. INSTALAÇÃO
    if (titulo.includes('INSTALA') || stage.includes('INSTALL') || stage.includes('EXTERNA') || stage.includes('LOJA')) return { setor: 'INSTALAÇÃO', cor: '#9b59b6' };
    
    // 5. CRM
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
        const cleanQuery = query.toString().trim();

        console.log(`--- INICIANDO BUSCA RESILIENTE PARA: "${cleanQuery}" ---`);

        // 1. BUSCA POR TÍTULO (O QUE FUNCIONOU NO LOG ANTERIOR)
        const responseTitle = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: { '%TITLE': cleanQuery },
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY'],
            order: { 'ID': 'DESC' }
        });

        let resultsArray = responseTitle.data.result || [];
        console.log(`Busca por Título encontrou: ${resultsArray.length} itens`);

        // 2. BUSCA POR ID (APENAS SE FOR NÚMERO E NÃO TIVER ENCONTRADO POR TÍTULO)
        if (!isNaN(cleanQuery)) {
            const responseId = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
                filter: { 'ID': cleanQuery },
                select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY']
            });
            const idResults = responseId.data.result || [];
            // Mesclar resultados sem duplicar
            idResults.forEach(item => {
                if (!resultsArray.find(r => r.ID === item.ID)) {
                    resultsArray.push(item);
                }
            });
        }

        // 3. LOG DE DIAGNÓSTICO (IMPORTANTE!)
        resultsArray.forEach((d, i) => {
            console.log(`[Item ${i+1}] ID: ${d.ID} | Título: ${d.TITLE} | StageID: ${d.STAGE_ID}`);
        });

        const finalResults = resultsArray.map(deal => {
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

        console.log(`--- BUSCA CONCLUÍDA: ${finalResults.length} RESULTADOS ---`);
        return res.status(200).json({ results: finalResults });

    } catch (error) {
        console.error('Erro na busca resiliente:', error.message);
        return res.status(500).json({ message: 'Erro interno.' });
    }
};
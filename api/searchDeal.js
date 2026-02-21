const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

/**
 * MAPEAMENTO OFICIAL DE SETORES (Baseado nos IDs do seu Bitrix)
 */
const MAPA_DE_SETORES = {
    "C17:UC_ZHMX6W": { nome: "IMPRESSÃO", cor: "#e67e22" },      // Laranja
    "C17:UC_QA8TN5": { nome: "ACABAMENTO", cor: "#1abc9c" },    // Turquesa
    "C17:UC_ZPMNF9": { nome: "INSTALAÇÃO EXT.", cor: "#9b59b6" }, // Roxo
    "C17:UC_EYLXD9": { nome: "INSTALAÇÃO LOJA", cor: "#8e44ad" }, // Roxo Escuro
    "C17:UC_IKPW6X": { nome: "PRONTO", cor: "#2ecc71" },        // Verde
    "C17:UC_G2024K": { nome: "PRONTO", cor: "#2ecc71" },        // Verde
    "C17:UC_WFTT1A": { nome: "PRONTO", cor: "#2ecc71" },        // Verde
    "WON":           { nome: "PRONTO / CONCLUÍDO", cor: "#27ae60" },
    "LOSE":          { nome: "CANCELADO", cor: "#e74c3c" }
};

function identificarSetor(stageId) {
    if (!stageId) return { setor: 'DESCONHECIDO', cor: '#95a5a6' };
    
    const stage = stageId.toUpperCase();

    // 1. Verifica se está no nosso mapa de IDs específicos
    if (MAPA_DE_SETORES[stage]) {
        return { 
            setor: MAPA_DE_SETORES[stage].nome, 
            cor: MAPA_DE_SETORES[stage].cor 
        };
    }

    // 2. Se for qualquer outro da Pipeline de Arte (C17), é ARTE
    if (stage.startsWith('C17')) {
        return { setor: 'ARTE', cor: '#3498db' }; // Azul
    }

    // 3. Se não for C17, é do CRM padrão (Vendas)
    return { setor: 'CRM (VENDAS)', cor: '#f1c40f' }; // Amarelo
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, query } = req.body;
        if (!sessionToken || !query) return res.status(400).json({ message: 'Dados insuficientes.' });

        const cleanQuery = query.toString().trim().replace('#', '');

        // 1. BUSCAR USUÁRIO PARA VALIDAÇÃO
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'NAME'] 
        });
        if (!userSearch.data.result?.length) return res.status(401).json({ message: 'Sessão inválida.' });

        // 2. BUSCA RESILIENTE (TÍTULO E ID SEPARADOS)
        // Busca por Título (que é o número do pedido no seu caso)
        const responseTitle = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: { '%TITLE': cleanQuery },
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY'],
            order: { 'ID': 'DESC' }
        });

        let resultsArray = responseTitle.data.result || [];

        // Busca por ID Interno (Fallback se digitar o ID de 5 dígitos do Bitrix)
        if (!isNaN(cleanQuery)) {
            const responseId = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
                filter: { 'ID': cleanQuery },
                select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY']
            });
            const idResults = responseId.data.result || [];
            idResults.forEach(item => {
                if (!resultsArray.find(r => r.ID === item.ID)) resultsArray.push(item);
            });
        }

        // 3. FORMATAR COM O NOVO MAPEAMENTO
        const finalResults = resultsArray.map(deal => {
            const info = identificarSetor(deal.STAGE_ID);
            return {
                id: deal.ID,
                titulo: deal.TITLE,
                data: deal.DATE_CREATE,
                valor: deal.OPPORTUNITY,
                setor: info.setor,
                cor_setor: info.cor
            };
        });

        console.log(`Busca para "${cleanQuery}" finalizada: ${finalResults.length} resultados.`);
        return res.status(200).json({ results: finalResults });

    } catch (error) {
        console.error('Erro na busca final:', error.message);
        return res.status(500).json({ message: 'Erro interno na busca.' });
    }
};
// /api/searchDeal.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

function identificarSetor(stageId, title = '') {
    if (!stageId) return { setor: 'DESCONHECIDO', cor: '#95a5a6' };
    const stage = stageId.toUpperCase();
    const titulo = title.toUpperCase();

    if (['WON', 'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K', 'LOSE'].includes(stage)) {
        return { setor: 'EXPEDIÇÃO / ARQUIVADO', cor: '#2ecc71' };
    }
    if (stage === 'C17:NEW' || stage === 'C17:UC_ZHMX6W' || stage === 'C17:UC_JHF0WH') {
        return { setor: 'ARTE (Novos)', cor: '#3498db' };
    }
    if (titulo.includes('INSTALA') || stage.includes('INSTALL') || stage.includes('EXTERNA') || stage.includes('LOJA')) {
        return { setor: 'INSTALAÇÃO', cor: '#9b59b6' };
    }
    if (stage.includes('PREPARATION') || stage.includes('EXECUTING')) {
        return { setor: 'IMPRESSÃO / ACABAMENTO', cor: '#e67e22' };
    }
    if (!stage.startsWith('C17')) {
        return { setor: 'CRM (Vendas)', cor: '#f1c40f' };
    }
    return { setor: 'EM PRODUÇÃO', cor: '#7f8c8d' };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        let { sessionToken, query } = req.body;

        if (!sessionToken || !query) return res.status(400).json({ message: 'Dados insuficientes.' });

        // 1. Limpar a query (remover espaços e o caractere # se existir)
        const cleanQuery = query.toString().trim().replace('#', '');

        // 2. SEGURANÇA: Validar sessão
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID'] 
        });

        if (!userSearch.data.result || !userSearch.data.result.length) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }
        
        // 3. CONFIGURAR FILTRO AGRESSIVO
        // O Bitrix às vezes falha no % quando é número. Vamos testar Título Exato, Título Parcial e ID.
        let filter = {
            'LOGIC': 'OR',
            'TITLE': cleanQuery,     // Busca exata (ex: "3596")
            '%TITLE': cleanQuery     // Busca parcial (ex: "Pedido 3596")
        };

        // Se for um número, adiciona a busca pelo ID interno do Bitrix também
        if (!isNaN(cleanQuery)) {
            filter['ID'] = cleanQuery; 
        }

        // 4. BUSCAR NO BITRIX
        const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filter,
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY'],
            order: { 'ID': 'DESC' }
        });

        const deals = searchResponse.data.result || [];

        // 5. FORMATAR RESULTADOS
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
        console.error('Erro detalhado SearchDeal:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro ao processar busca.' });
    }
};
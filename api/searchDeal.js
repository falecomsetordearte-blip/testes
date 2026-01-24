// /api/searchDeal.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

/**
 * Função para categorizar o pedido baseando-se no ID da fase (STAGE_ID)
 * ou no Título, caso o ID seja genérico.
 */
function identificarSetor(stageId, title = '') {
    if (!stageId) return { setor: 'DESCONHECIDO', cor: '#95a5a6' };
    
    const stage = stageId.toUpperCase();
    const titulo = title.toUpperCase();

    // 1. EXPEDIÇÃO (Fases Finais / Entregues / Pagas)
    // WON = Ganho/Finalizado no Bitrix padrão
    if (['WON', 'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K', 'LOSE'].includes(stage)) {
        return { setor: 'EXPEDIÇÃO / ARQUIVADO', cor: '#2ecc71' }; // Verde
    }

    // 2. ARTE (Início do fluxo de produção)
    if (stage === 'C17:NEW' || stage === 'C17:UC_ZHMX6W' || stage === 'C17:UC_JHF0WH') {
        return { setor: 'ARTE (Novos)', cor: '#3498db' }; // Azul
    }

    // 3. INSTALAÇÃO (Tenta identificar por palavra-chave se não tivermos o ID exato)
    if (titulo.includes('INSTALA') || stage.includes('INSTALL') || stage.includes('EXTERNA') || stage.includes('LOJA')) {
        return { setor: 'INSTALAÇÃO', cor: '#9b59b6' }; // Roxo
    }

    // 4. IMPRESSÃO / ACABAMENTO (Meio do fluxo)
    if (stage.includes('PREPARATION') || stage.includes('EXECUTING')) {
        return { setor: 'IMPRESSÃO / ACABAMENTO', cor: '#e67e22' }; // Laranja
    }

    // 5. CRM (Negociação - Fases que não começam com o prefixo de produção C17)
    if (!stage.startsWith('C17')) {
        return { setor: 'CRM (Vendas)', cor: '#f1c40f' }; // Amarelo
    }

    // Fallback para qualquer outra fase de produção
    return { setor: 'EM PRODUÇÃO', cor: '#7f8c8d' }; // Cinza
}

module.exports = async (req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { sessionToken, query } = req.body;

        if (!sessionToken || !query) {
            return res.status(400).json({ message: 'Dados insuficientes.' });
        }

        // 1. Identificar Empresa (Segurança)
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['COMPANY_ID']
        });

        if (!userSearch.data.result || !userSearch.data.result.length) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }
        const companyId = userSearch.data.result[0].COMPANY_ID;

        // 2. Configurar Filtro (ID ou Título)
        let filter = {
            'COMPANY_ID': companyId,
            'LOGIC': 'OR',
            '%TITLE': query // Busca "contém" no título
        };

        // Se for número, busca também pelo ID exato
        if (!isNaN(query)) {
            filter['=ID'] = query;
        }

        // 3. Buscar no Bitrix
        const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filter,
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY'],
            order: { 'ID': 'DESC' },
            start: 0
        });

        const deals = searchResponse.data.result || [];

        // 4. Formatar resposta
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
        console.error('Erro SearchDeal:', error.message);
        return res.status(500).json({ message: 'Erro interno.' });
    }
};
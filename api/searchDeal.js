// /api/searchDeal.js

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

/**
 * Função que traduz o ID da fase do Bitrix para uma Categoria Legível e uma Cor.
 * Baseado nos IDs que você forneceu anteriormente e padrões comuns.
 */
function identificarSetor(stageId) {
    if (!stageId) return { setor: 'DESCONHECIDO', cor: '#95a5a6' }; // Cinza

    // --- EXPEDIÇÃO (Fases Finais) ---
    // C17:UC_IKPW6X (Finalizado/Entregue), C17:UC_WFTT1A (Pago), C17:UC_G2024K (Devedor), WON (Ganho)
    const fasesExpedicao = ['C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K', 'WON', 'LOSE'];
    if (fasesExpedicao.includes(stageId)) {
        return { setor: 'EXPEDIÇÃO / ARQUIVADO', cor: '#2ecc71' }; // Verde
    }

    // --- ARTE (Início do Pipeline de Produção) ---
    // C17:NEW (Novos Pedidos), C17:UC_ZHMX6W (Conferência)
    if (stageId === 'C17:NEW' || stageId === 'C17:UC_ZHMX6W' || stageId === 'C17:UC_JHF0WH') {
        return { setor: 'ARTE / DESIGN', cor: '#3498db' }; // Azul
    }

    // --- IMPRESSÃO E ACABAMENTO (Meio do Pipeline) ---
    // IDs genéricos de produção (Exemplos baseados em lógica padrão se não tivermos o ID exato)
    // Se o ID contiver "PREPARATION" ou "EXECUTING" dentro do pipeline C17
    if (stageId.includes('C17:PREPARATION') || stageId.includes('C17:EXECUTING')) {
        return { setor: 'IMPRESSÃO / ACABAMENTO', cor: '#e67e22' }; // Laranja
    }

    // --- INSTALAÇÃO (Se houver fases específicas identificadas) ---
    // Como não temos o ID exato da Instalação nos seus arquivos anteriores, 
    // colocamos uma lógica de fallback. Se você descobrir o ID da instalação, adicione aqui.
    if (stageId.includes('INSTALL') || stageId.includes('EXTERNA')) {
        return { setor: 'INSTALAÇÃO', cor: '#9b59b6' }; // Roxo
    }

    // --- CRM (Pipeline de Vendas - Padrão do Bitrix) ---
    // IDs como NEW, PREPARATION, DETAILS, PREPAYMENT_INVOICE (sem prefixo C17)
    if (!stageId.startsWith('C17')) {
        return { setor: 'CRM (Negociação)', cor: '#f1c40f' }; // Amarelo
    }

    // --- GENÉRICO (Qualquer outra fase C17 não mapeada) ---
    return { setor: 'EM PRODUÇÃO', cor: '#7f8c8d' }; // Cinza Escuro
}

module.exports = async (req, res) => {
    // 1. Configuração de CORS (Essencial para não bloquear o frontend)
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

        // 2. Segurança: Identificar a empresa do usuário logado
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['COMPANY_ID']
        });

        if (!userSearch.data.result || !userSearch.data.result.length) {
            return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
        }
        
        const companyId = userSearch.data.result[0].COMPANY_ID;

        // 3. Montar Filtro de Busca
        // Lógica: Busca onde a Empresa é a do usuário E (Titulo contem termo OU ID é igual termo)
        let filter = {
            'COMPANY_ID': companyId,
            'LOGIC': 'OR',
            '%TITLE': query // % significa "contém" (LIKE no SQL)
        };

        // Se o usuário digitou um número, tenta buscar pelo ID exato do pedido também
        if (!isNaN(query)) {
            filter['=ID'] = query;
        }

        // 4. Chamada ao Bitrix
        const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filter,
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY'],
            order: { 'ID': 'DESC' }, // Mais recentes primeiro
            start: 0
        });

        const deals = searchResponse.data.result || [];

        // 5. Formatar Resposta para o Frontend
        const results = deals.map(deal => {
            // Identifica onde o pedido está (CRM, Arte, Expedição...)
            const infoSetor = identificarSetor(deal.STAGE_ID);
            
            return {
                id: deal.ID,
                titulo: deal.TITLE,
                data: deal.DATE_CREATE,
                valor: deal.OPPORTUNITY,
                setor: infoSetor.setor,      // Texto (ex: "ARTE")
                cor_setor: infoSetor.cor,    // Cor Hex (ex: "#3498db")
                stage_id: deal.STAGE_ID      // Útil para debug
            };
        });

        return res.status(200).json({ results });

    } catch (error) {
        console.error('Erro no searchDeal:', error.message);
        return res.status(500).json({ message: 'Erro interno ao realizar a busca.' });
    }
};
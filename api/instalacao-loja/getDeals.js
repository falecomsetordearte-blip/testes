// /api/instalacao-loja/getDeals.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Campos que retornaremos para o frontend
const SELECT_FIELDS = [
    'ID', 
    'TITLE', 
    'STAGE_ID', 
    'UF_CRM_1741273407628', // Nome Cliente
    'UF_CRM_1749481565243', // Contato
    'UF_CRM_1752712769666', // Link Atendimento
    'UF_CRM_1727464924690', // Medidas
    'UF_CRM_1748277308731', // Link Arquivo Final
    'UF_CRM_1757794109',    // Prazo Final
    'UF_CRM_1764124589418'  // NOVO: Link do Layout (Imagem)
];

module.exports = async (req, res) => {
    // Apenas método POST é permitido
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(401).json({ message: 'Token de autenticação obrigatório.' });
        }

        // 1. Validar Token e Identificar a Empresa do Usuário
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userSearch.data.result ? userSearch.data.result[0] : null;

        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não vinculada.' });
        }

        // 2. Configurar Filtros de Busca
        // CATEGORY_ID: 17 (Pipeline de Instalação)
        // STAGE_ID: 'C17:UC_EYLXD9' (Fase específica para Instalação na Loja)
        // COMPANY_ID: Filtra apenas pedidos da empresa logada
        const filterParams = {
            'CATEGORY_ID': 17,
            'COMPANY_ID': user.COMPANY_ID,
            'STAGE_ID': 'C17:UC_EYLXD9'
        };

        // 3. Buscar no Bitrix
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' }, // Mais recentes primeiro
            select: SELECT_FIELDS
        });

        const deals = response.data.result || [];

        return res.status(200).json({ deals: deals });

    } catch (error) {
        console.error('Erro ao buscar pedidos de instalação na loja:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro interno ao buscar pedidos.' });
    }
};
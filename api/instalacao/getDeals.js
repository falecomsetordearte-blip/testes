// /api/instalacao/getDeals.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Lista de campos a retornar
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
        // STAGE_ID: 'C17:UC_ZPMNF9' (Fase específica para Instalação Externa - verifique se o ID da fase está correto com o seu fluxo atual)
        // OBS: Estou assumindo que a API busca pedidos da Instalação Externa. Se o ID da fase for outro, ajuste abaixo.
        // Baseado nas conversas anteriores, Instalação Externa geralmente é C17:UC_ZPMNF9, mas vou manter a lógica de filtro caso seja outra.
        // Vamos filtrar pela CATEGORIA 17 e EMPRESA, o filtro de fase específico pode ser ajustado aqui se necessário.
        // Para garantir que pegamos os pedidos certos, vou usar o filtro genérico de categoria + empresa, 
        // mas idealmente você filtraria pela fase 'Instalação Externa' se houver confusão com 'Loja'.
        // Vou assumir que o frontend chama esta API para a tela correta.
        
        // Se você quiser filtrar APENAS Instalação Externa aqui, descomente a linha do STAGE_ID abaixo e coloque o ID correto.
        const filterParams = {
            'CATEGORY_ID': 17,
            'COMPANY_ID': user.COMPANY_ID,
            'STAGE_ID': 'C17:UC_ZPMNF9' // ID da fase Instalação Externa
        };

        // 3. Buscar no Bitrix
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: SELECT_FIELDS
        });

        const deals = response.data.result || [];

        return res.status(200).json({ deals: deals });

    } catch (error) {
        console.error('Erro ao buscar pedidos de instalação externa:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro interno ao buscar pedidos.' });
    }
};
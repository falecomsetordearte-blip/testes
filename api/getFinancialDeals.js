// /api/getFinancialDeals.js - VERSÃO SEGURA E CORRIGIDA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ITEMS_PER_PAGE = 20; // Itens por página

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, page = 0, statusFilter, nameFilter } = req.body;

        // ETAPA 1: VALIDAR O TOKEN E ENCONTRAR A EMPRESA
        if (!sessionToken) {
            return res.status(401).json({ message: 'Acesso não autorizado. Token é obrigatório.' });
        }

        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }

        // ETAPA 2: Construir o objeto de filtro dinamicamente, AGORA COM O COMPANY_ID
        const filterParams = {
            'CATEGORY_ID': 11,
            'COMPANY_ID': user.COMPANY_ID // <-- FILTRO DE SEGURANÇA ADICIONADO
        };
        
        if (nameFilter && nameFilter.trim() !== '') {
            filterParams['%TITLE'] = nameFilter.trim();
        }
        
        if (statusFilter && statusFilter !== 'todos') {
            filterParams['STAGE_ID'] = statusFilter;
        } else {
            filterParams['STAGE_ID'] = [
                'C11:UC_YYHPKI',
                'C11:UC_4SNWR7',
                'C11:UC_W0DCSV'
            ];
        }

        // ETAPA 3: Buscar os negócios no Bitrix24 usando o filtro seguro
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CONTACT_ID', 'COMPANY_ID'],
            start: page * ITEMS_PER_PAGE
        });

        const deals = response.data.result || [];
        const total = response.data.total || 0;

        // ETAPA 4: Montar a resposta com os dados e informações de paginação
        return res.status(200).json({
            deals: deals,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / ITEMS_PER_PAGE),
                totalDeals: total
            }
        });

    } catch (error) {
        console.error('Erro ao buscar negócios financeiros:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
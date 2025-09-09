// /api/getFinancialDeals.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ITEMS_PER_PAGE = 20; // Itens por página

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        // A página e o filtro são recebidos do frontend
        const { page = 0, statusFilter, nameFilter } = req.body;

        // ETAPA 1: Construir o objeto de filtro dinamicamente
        const filterParams = {
            'CATEGORY_ID': 11,
        };
        // Adiciona o filtro de nome se ele for fornecido
        if (nameFilter && nameFilter.trim() !== '') {
            filterParams['%TITLE'] = nameFilter.trim();
        }
        // Adiciona o filtro de status apenas se um específico for selecionado
        if (statusFilter && statusFilter !== 'todos') {
            filterParams['STAGE_ID'] = statusFilter;
        } else {
            // Caso contrário, busca em todos os status relevantes do pipeline 11
            filterParams['STAGE_ID'] = [
                'C11:UC_YYHPKI',
                'C11:UC_4SNWR7',
                'C11:UC_W0DCSV'
            ];
        }

        // ETAPA 2: Buscar os negócios no Bitrix24 usando o filtro construído
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' }, // Ordena pelos mais recentes
            select: ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CONTACT_ID', 'COMPANY_ID'],
            start: page * ITEMS_PER_PAGE // Ponto de partida para a paginação
        });

        const deals = response.data.result || [];
        const total = response.data.total || 0;

        // ETAPA 3: Montar a resposta com os dados e informações de paginação
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
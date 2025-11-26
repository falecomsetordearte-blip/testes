// /api/getFinancialDeals.js - COMPLETO

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Cabeçalhos básicos
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        const { sessionToken, page = 0, statusFilter, nameFilter } = req.body;

        // 1. Validar Token de Sessão
        if (!sessionToken) return res.status(401).json({ message: 'Acesso não autorizado' });
        
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });
        const user = userCheck.data.result[0];
        if (!user || !user.COMPANY_ID) return res.status(401).json({ message: 'Sessão inválida' });

        // 2. Configuração dos IDs (Sincronizado com o Frontend)
        const STAGE_VERIFICAR = 'C17:UC_IKPW6X';
        const STAGE_PAGO      = 'C17:UC_WFTT1A';
        const STAGE_COBRAR    = 'C17:UC_G2024K'; // Atualizado

        // 3. Montar Filtro
        let filter = {
            'COMPANY_ID': user.COMPANY_ID
        };

        if (statusFilter === 'todos') {
            // Traz todos os 3 status pertinentes ao financeiro
            filter['@STAGE_ID'] = [STAGE_VERIFICAR, STAGE_PAGO, STAGE_COBRAR];
        } else if (statusFilter) {
            // Filtro específico clicado na aba
            filter['STAGE_ID'] = statusFilter;
        } else {
            // Fallback (padrão)
            filter['STAGE_ID'] = STAGE_VERIFICAR;
        }

        // Filtro por nome
        if (nameFilter) {
            filter['%TITLE'] = nameFilter;
        }

        // 4. Executar Busca no Bitrix
        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filter,
            select: ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CURRENCY_ID'],
            order: { 'ID': 'DESC' },
            start: page * 50 // Paginação simples
        });

        const deals = response.data.result || [];
        const total = response.data.total || 0;

        // 5. Retorno
        return res.status(200).json({
            deals: deals,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / 50),
                totalItems: total
            }
        });

    } catch (error) {
        console.error('Erro getFinancialDeals:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro interno ao buscar pedidos.' });
    }
};
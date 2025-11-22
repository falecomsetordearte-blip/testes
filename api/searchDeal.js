// /api/searchDeal.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// CONFIGURAÇÃO: Mapeie aqui os IDs das fases do Bitrix para nomes legíveis
// Você descobre esses IDs inspecionando o Bitrix ou vendo o retorno da API
const STAGE_MAP = {
    'NEW': 'Novo Pedido',
    'PREPARATION': 'Em Preparação',
    'PREPAYMENT_INVOICE': 'Aguardando Pagamento',
    'EXECUTING': 'Em Arte', // Exemplo
    'FINAL_INVOICE': 'Em Impressão', // Exemplo
    'WON': 'Finalizado',
    'LOSE': 'Cancelado',
    // Adicione os códigos específicos do seu funil (ex: C1:NEW, C4:EXECUTING)
    // Se não souber os códigos agora, o código retornará o ID original.
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, query } = req.body;

        if (!sessionToken || !query) {
            return res.status(400).json({ message: 'Token e termo de busca são obrigatórios.' });
        }

        // 1. Identificar a empresa do usuário logado (Segurança)
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, // Seu campo de token
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // 2. Preparar o filtro de busca
        // Vamos buscar se o termo está no TÍTULO OU se é o ID do pedido
        let filter = {
            'COMPANY_ID': user.COMPANY_ID, // TRAVA DE SEGURANÇA: Só busca pedidos desta empresa
            'LOGIC': 'OR',
            '%TITLE': query // Busca parcial no título
        };

        // Se o termo for numérico, tenta buscar pelo ID exato também
        if (!isNaN(query)) {
            filter['=ID'] = query;
        }

        // 3. Buscar no Bitrix
        const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list`, {
            filter: filter,
            select: ['ID', 'TITLE', 'STAGE_ID', 'DATE_CREATE', 'OPPORTUNITY']
        });

        const deals = searchResponse.data.result;

        // 4. Formatar os resultados
        const formattedDeals = deals.map(deal => {
            // Tenta traduzir a fase, se não conseguir, mostra o ID da fase
            const nomeFase = STAGE_MAP[deal.STAGE_ID] || deal.STAGE_ID;

            return {
                id: deal.ID,
                titulo: deal.TITLE,
                fase: nomeFase,
                fase_id: deal.STAGE_ID,
                valor: deal.OPPORTUNITY,
                data: deal.DATE_CREATE
            };
        });

        return res.status(200).json({ 
            results: formattedDeals,
            count: formattedDeals.length
        });

    } catch (error) {
        console.error('Erro na busca:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro ao realizar a busca.' });
    }
};
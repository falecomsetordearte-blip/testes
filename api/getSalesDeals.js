// /api/getSalesDeals.js - VERSÃO SEGURA E CORRIGIDA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ITEMS_PER_COLUMN = 10;

const STAGES = {
    contato_inicial: 'UC_Z087DH',
    orcamento_enviado: 'UC_56HAVY',
    aguardando_pagamento: 'UC_XF49AO'
};

// A função auxiliar agora recebe o companyId para filtrar a busca
async function fetchAndProcessColumn(stageKey, page, companyId) {
    // 1. MONTAR O FILTRO COM O COMPANY_ID
    const filter = {
        CATEGORY_ID: 0,
        STAGE_ID: STAGES[stageKey],
        COMPANY_ID: companyId // <-- AQUI A SEGURANÇA É APLICADA
    };

    // 2. BUSCAR OS NEGÓCIOS DA COLUNA, JÁ FILTRADOS POR EMPRESA
    const dealsResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
        filter: filter,
        order: { 'ID': 'DESC' },
        select: ['ID', 'TITLE', 'OPPORTUNITY', 'CONTACT_ID'],
        start: page * ITEMS_PER_COLUMN
    });
    let deals = dealsResponse.data.result || [];
    if (deals.length === 0) return [];

    // 3. BUSCAR ATIVIDADES NÃO LIDAS (lógica inalterada)
    const dealIds = deals.map(d => d.ID);
    const activityResponse = await axios.post(`${BITRIX24_API_URL}crm.activity.list`, {
        filter: {
            OWNER_TYPE_ID: 2,
            OWNER_ID: dealIds,
            COMPLETED: 'N'
        },
        select: ['OWNER_ID']
    });

    const dealsComAtividadesNaoLidas = new Set(
        (activityResponse.data.result || []).map(act => act.OWNER_ID)
    );

    // 4. ENRIQUECER OS DADOS DOS NEGÓCIOS (lógica inalterada)
    deals = deals.map(deal => ({
        ...deal,
        nao_lido: dealsComAtividadesNaoLidas.has(deal.ID)
    }));

    // 5. ORDENAR (lógica inalterada)
    deals.sort((a, b) => {
        if (a.nao_lido !== b.nao_lido) {
            return a.nao_lido ? -1 : 1;
        }
        const valorA = parseFloat(a.OPPORTUNITY) || 0;
        const valorB = parseFloat(b.OPPORTUNITY) || 0;
        return valorB - valorA;
    });
    
    return deals;
}

module.exports = async (req, res) => {
    try {
        const { sessionToken, pages = {} } = req.body;

        // ETAPA 1: VALIDAR O TOKEN E ENCONTRAR A EMPRESA
        if (!sessionToken) {
            return res.status(401).json({ message: 'Acesso não autorizado. Token é obrigatório.' });
        }

        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }
        
        const companyId = user.COMPANY_ID; // Guardamos o ID da empresa para usar nas buscas

        // ETAPA 2: BUSCAR OS DADOS DAS COLUNAS, PASSANDO O COMPANY_ID
        const [contato_inicial, orcamento_enviado, aguardando_pagamento] = await Promise.all([
            fetchAndProcessColumn('contato_inicial', pages.contato_inicial || 0, companyId),
            fetchAndProcessColumn('orcamento_enviado', pages.orcamento_enviado || 0, companyId),
            fetchAndProcessColumn('aguardando_pagamento', pages.aguardando_pagamento || 0, companyId)
        ]);
        
        const allDeals = [...contato_inicial, ...orcamento_enviado, ...aguardando_pagamento];

        // ETAPA 3: BUSCAR NOMES DOS CONTATOS (lógica inalterada)
        let contactIds = allDeals.map(deal => deal.CONTACT_ID).filter(Boolean);
        let contacts = {};
        if (contactIds.length > 0) {
            const uniqueContactIds = [...new Set(contactIds)];
            const contactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list`, {
                filter: { ID: uniqueContactIds },
                select: ['ID', 'NAME', 'LAST_NAME']
            });
            (contactResponse.data.result || []).forEach(c => {
                contacts[c.ID] = `${c.NAME || ''} ${c.LAST_NAME || ''}`.trim();
            });
        }
        
        // ETAPA 4: COMBINAR DADOS FINAIS (lógica inalterada)
        const finalData = {
            contato_inicial: contato_inicial.map(deal => ({ ...deal, CONTACT_NAME: contacts[deal.CONTACT_ID] || 'N/A' })),
            orcamento_enviado: orcamento_enviado.map(deal => ({ ...deal, CONTACT_NAME: contacts[deal.CONTACT_ID] || 'N/A' })),
            aguardando_pagamento: aguardando_pagamento.map(deal => ({ ...deal, CONTACT_NAME: contacts[deal.CONTACT_ID] || 'N/A' }))
        };

        res.status(200).json(finalData);

    } catch (error) {
        console.error('Erro ao buscar negócios de vendas:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
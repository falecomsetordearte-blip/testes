// /api/getSalesDeals.js - VERSÃO COM ORDENAÇÃO AVANÇADA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ITEMS_PER_COLUMN = 10; // CUIDADO: A ordenação será feita nesses 10. Para uma ordenação global, a lógica seria mais complexa.

const STAGES = {
    contato_inicial: 'UC_Z087DH',
    orcamento_enviado: 'UC_56HAVY',
    aguardando_pagamento: 'UC_XF49AO'
};

async function fetchAndProcessColumn(stageKey, page) {
    // 1. BUSCAR OS NEGÓCIOS DA COLUNA
    const dealsResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
        filter: { CATEGORY_ID: 0, STAGE_ID: STAGES[stageKey] },
        order: { 'ID': 'DESC' }, // Pega os mais recentes primeiro
        select: ['ID', 'TITLE', 'OPPORTUNITY', 'CONTACT_ID'],
        start: page * ITEMS_PER_COLUMN
    });
    let deals = dealsResponse.data.result || [];
    if (deals.length === 0) return []; // Retorna vazio se não houver negócios

    // 2. BUSCAR ATIVIDADES NÃO LIDAS PARA ESSES NEGÓCIOS
    const dealIds = deals.map(d => d.ID);
    const activityResponse = await axios.post(`${BITRIX24_API_URL}crm.activity.list`, {
        filter: {
            OWNER_TYPE_ID: 2, // 2 = Deal
            OWNER_ID: dealIds,
            COMPLETED: 'N' // 'N' = Não completada (não lida)
        },
        select: ['OWNER_ID'] // Só precisamos saber a qual negócio a atividade pertence
    });

    const dealsComAtividadesNaoLidas = new Set(
        (activityResponse.data.result || []).map(act => act.OWNER_ID)
    );

    // 3. ENRIQUECER OS DADOS DOS NEGÓCIOS
    deals = deals.map(deal => ({
        ...deal,
        nao_lido: dealsComAtividadesNaoLidas.has(deal.ID)
    }));

    // 4. ORDENAR DE ACORDO COM A SUA REGRA
    deals.sort((a, b) => {
        // Prioridade 1: Não lido (true vem antes de false)
        if (a.nao_lido !== b.nao_lido) {
            return a.nao_lido ? -1 : 1;
        }
        // Se ambos são "não lidos" ou ambos são "lidos", ordena pelo valor (mais caro primeiro)
        const valorA = parseFloat(a.OPPORTUNITY) || 0;
        const valorB = parseFloat(b.OPPORTUNITY) || 0;
        return valorB - valorA;
    });
    
    // (A lógica de buscar contatos será movida para o bloco principal)
    return deals;
}

module.exports = async (req, res) => {
    try {
        const { pages = {} } = req.body;

        const [contato_inicial, orcamento_enviado, aguardando_pagamento] = await Promise.all([
            fetchAndProcessColumn('contato_inicial', pages.contato_inicial || 0),
            fetchAndProcessColumn('orcamento_enviado', pages.orcamento_enviado || 0),
            fetchAndProcessColumn('aguardando_pagamento', pages.aguardando_pagamento || 0)
        ]);
        
        const allDeals = [...contato_inicial, ...orcamento_enviado, ...aguardando_pagamento];

        // Buscar nomes dos contatos
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
        
        // Combinar dados finais
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
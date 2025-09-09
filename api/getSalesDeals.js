// /api/getSalesDeals.js - VERSÃO SIMPLIFICADA E ROBUSTA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ITEMS_PER_COLUMN = 10;

const STAGES = {
    contato_inicial: 'UC_Z087DH',
    orcamento_enviado: 'UC_56HAVY',
    aguardando_pagamento: 'UC_XF49AO'
};

// Função auxiliar para buscar uma coluna específica
async function fetchColumn(stageKey, page) {
    const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
        filter: { 
            CATEGORY_ID: 0,
            STAGE_ID: STAGES[stageKey]
        },
        order: { 'ID': 'DESC' },
        select: ['ID', 'TITLE', 'OPPORTUNITY', 'CONTACT_ID'],
        start: page * ITEMS_PER_COLUMN
    });
    return response.data.result || [];
}

module.exports = async (req, res) => {
    try {
        const { pages = {} } = req.body;

        // ETAPA 1: Buscar os dados de cada coluna em paralelo
        const [contato_inicial, orcamento_enviado, aguardando_pagamento] = await Promise.all([
            fetchColumn('contato_inicial', pages.contato_inicial || 0),
            fetchColumn('orcamento_enviado', pages.orcamento_enviado || 0),
            fetchColumn('aguardando_pagamento', pages.aguardando_pagamento || 0)
        ]);
        
        const allDeals = [...contato_inicial, ...orcamento_enviado, ...aguardando_pagamento];

        // ETAPA 2: Buscar nomes dos contatos (lógica existente e correta)
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
        
        // ETAPA 3: Combinar dados e enviar resposta
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
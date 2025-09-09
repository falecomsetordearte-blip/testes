// /api/getSalesDeals.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ITEMS_PER_COLUMN = 10; // Quantos cards carregar por vez em cada coluna

// Mapeamento dos stages para facilitar
const STAGES = {
    contato_inicial: 'UC_Z087DH',
    orcamento_enviado: 'UC_56HAVY',
    aguardando_pagamento: 'UC_XF49AO'
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { pages = {} } = req.body; // Recebe um objeto com a página atual de cada coluna

        // Prepara as chamadas para cada coluna em paralelo
        const batchCommands = {
            contato_inicial: `crm.deal.list?` + new URLSearchParams({
                order: 'ID:DESC',
                filter: { CATEGORY_ID: 0, STAGE_ID: STAGES.contato_inicial },
                select: 'ID,TITLE,OPPORTUNITY,CONTACT_ID',
                start: (pages.contato_inicial || 0) * ITEMS_PER_COLUMN
            }),
            orcamento_enviado: `crm.deal.list?` + new URLSearchParams({
                order: 'ID:DESC',
                filter: { CATEGORY_ID: 0, STAGE_ID: STAGES.orcamento_enviado },
                select: 'ID,TITLE,OPPORTUNITY,CONTACT_ID',
                start: (pages.orcamento_enviado || 0) * ITEMS_PER_COLUMN
            }),
            aguardando_pagamento: `crm.deal.list?` + new URLSearchParams({
                order: 'ID:DESC',
                filter: { CATEGORY_ID: 0, STAGE_ID: STAGES.aguardando_pagamento },
                select: 'ID,TITLE,OPPORTUNITY,CONTACT_ID',
                start: (pages.aguardando_pagamento || 0) * ITEMS_PER_COLUMN
            })
        };

        const batchResponse = await axios.post(`${BITRIX24_API_URL}batch`, { cmd: batchCommands });
        const results = batchResponse.data.result.result;

        // ETAPA 2: Buscar nomes dos contatos
        let contactIds = [];
        Object.values(results).forEach(column => {
            (column || []).forEach(deal => {
                if (deal.CONTACT_ID) contactIds.push(deal.CONTACT_ID);
            });
        });
        
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
        const finalData = {};
        for (const key in results) {
            finalData[key] = (results[key] || []).map(deal => ({
                ...deal,
                CONTACT_NAME: contacts[deal.CONTACT_ID] || 'Contato não encontrado'
            }));
        }

        res.status(200).json(finalData);

    } catch (error) {
        console.error('Erro ao buscar negócios de vendas:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
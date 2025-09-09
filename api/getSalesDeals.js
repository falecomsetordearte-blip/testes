// /api/getSalesDeals.js - VERSÃO COM DEPURAÇÃO
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ITEMS_PER_COLUMN = 10;

const STAGES = {
    contato_inicial: 'UC_Z087DH',
    orcamento_enviado: 'UC_56HAVY',
    aguardando_pagamento: 'UC_XF49AO'
};

module.exports = async (req, res) => {
    console.log("--- [getSalesDeals] API INICIADA ---");
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { pages = {} } = req.body;

        const batchCommands = {
            contato_inicial: `crm.deal.list?` + new URLSearchParams({
                order: 'ID:DESC',
                filter: { CATEGORY_ID: 17, STAGE_ID: 'C17:NEW' }, // <-- Alterado para Pipeline 17 e Stage de exemplo
                select: 'ID,TITLE,OPPORTUNITY,CONTACT_ID',
                start: (pages.contato_inicial || 0) * ITEMS_PER_COLUMN
            }),
            orcamento_enviado: `crm.deal.list?` + new URLSearchParams({
                order: 'ID:DESC',
                filter: { CATEGORY_ID: 17, STAGE_ID: 'C17:UC_2OEE24' }, // <-- Alterado para Pipeline 17 e Stage de exemplo
                select: 'ID,TITLE,OPPORTUNITY,CONTACT_ID',
                start: (pages.orcamento_enviado || 0) * ITEMS_PER_COLUMN
            }),
            aguardando_pagamento: `crm.deal.list?` + new URLSearchParams({
                order: 'ID:DESC',
                filter: { CATEGORY_ID: 17, STAGE_ID: 'C17:PREPARATION' }, // <-- Alterado para Pipeline 17 e Stage de exemplo
                select: 'ID,TITLE,OPPORTUNITY,CONTACT_ID',
                start: (pages.aguardando_pagamento || 0) * ITEMS_PER_COLUMN
            })
        };

        const batchResponse = await axios.post(`${BITRIX24_API_URL}batch`, { cmd: batchCommands });
        const results = batchResponse.data.result.result;
        console.log("[DEBUG] Resposta BATCH recebida do Bitrix24.");

        // Log para ver o que cada coluna retornou
        console.log("[DEBUG] Resultados por coluna:", {
            contato_inicial: results.contato_inicial?.length || 0,
            orcamento_enviado: results.orcamento_enviado?.length || 0,
            aguardando_pagamento: results.aguardando_pagamento?.length || 0,
        });

        let contactIds = [];
        Object.values(results).forEach(column => {
            (column || []).forEach(deal => {
                if (deal.CONTACT_ID) contactIds.push(deal.CONTACT_ID);
            });
        });
        console.log(`[DEBUG] Total de IDs de contato a serem buscados: ${contactIds.length}`);
        
        let contacts = {};
        if (contactIds.length > 0) {
            const uniqueContactIds = [...new Set(contactIds)];
            console.log(`[DEBUG] Buscando informações para ${uniqueContactIds.length} contatos únicos...`);
            const contactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list`, {
                filter: { ID: uniqueContactIds },
                select: ['ID', 'NAME', 'LAST_NAME']
            });
            (contactResponse.data.result || []).forEach(c => {
                contacts[c.ID] = `${c.NAME || ''} ${c.LAST_NAME || ''}`.trim();
            });
            console.log("[DEBUG] Informações de contatos carregadas.");
        }
        
        const finalData = {};
        for (const key in results.result) {
            finalData[key] = (results.result[key] || []).map(deal => ({
                ...deal,
                CONTACT_NAME: contacts[deal.CONTACT_ID] || 'Contato não encontrado'
            }));
        }

        console.log("--- [getSalesDeals] API CONCLUÍDA COM SUCESSO ---");
        res.status(200).json(finalData);

    } catch (error) {
        console.error('--- [ERRO] em getSalesDeals ---');
        if (error.response) {
            console.error("ERRO DETALHADO DA API:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Erro geral:", error.message);
        }
        res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
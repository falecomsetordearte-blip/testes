// /api/arte/getBoardData.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const STAGE_ARTE = 'C17:UC_JHF0WH'; // Fase "Em Criação/Arte"

const SELECT_FIELDS = [
    'ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY',
    'UF_CRM_1741273407628', // Nome Cliente
    'UF_CRM_1749481565243', // Contato Cliente
    'UF_CRM_1761269158',    // Tipo de Arte
    'UF_CRM_1752712769666', // Link Acompanhar
    'UF_CRM_1764429361',    // Link Designer
    'UF_CRM_1727464924690'  // Medidas
];

module.exports = async (req, res) => {
    // ID único para rastrear esta requisição nos logs
    const reqId = `REQ-${Date.now()}`;
    console.log(`\n[${reqId}] >>> INICIANDO getBoardData`);

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken } = req.body;
        
        // 1. Auth e Empresa
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['ID', 'COMPANY_ID']
        });
        
        const user = userCheck.data.result ? userCheck.data.result[0] : null;
        if (!user || !user.COMPANY_ID) {
            console.log(`[${reqId}] Erro: Usuário ou Empresa não encontrados no Bitrix.`);
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        console.log(`[${reqId}] Usuário Bitrix ID: ${user.ID} | Company ID: ${user.COMPANY_ID}`);

        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1`;
        
        if (!empresas.length) {
            console.log(`[${reqId}] Erro: Empresa ID ${user.COMPANY_ID} não cadastrada no Neon.`);
            return res.status(403).json({ message: 'Empresa não encontrada.' });
        }
        const empresaId = empresas[0].id;
        console.log(`[${reqId}] Empresa Neon ID: ${empresaId}`);

        // 2. Buscar Deals no Bitrix
        const filterBitrix = { 
            'CATEGORY_ID': 17, 
            'COMPANY_ID': user.COMPANY_ID,
            'STAGE_ID': STAGE_ARTE 
        };
        
        console.log(`[${reqId}] Buscando no Bitrix com filtro:`, JSON.stringify(filterBitrix));

        const bxResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterBitrix,
            select: SELECT_FIELDS
        });
        
        const dealsBitrix = bxResponse.data.result || [];
        console.log(`[${reqId}] Retorno Bitrix: ${dealsBitrix.length} pedidos encontrados.`);

        // 3. Buscar Estado Local
        const localCards = await prisma.$queryRaw`SELECT * FROM painel_arte_cards WHERE empresa_id = ${empresaId}`;
        const localMap = new Map(localCards.map(c => [c.bitrix_deal_id, c]));
        console.log(`[${reqId}] Estado Local: ${localCards.length} registros encontrados.`);

        // 4. Merge
        const mergedDeals = [];

        for (const deal of dealsBitrix) {
            const dealId = parseInt(deal.ID);
            let coluna = 'NOVOS';
            let posicao = 9999;

            if (localMap.has(dealId)) {
                const local = localMap.get(dealId);
                coluna = local.coluna;
                posicao = local.posicao;
            } else {
                console.log(`[${reqId}] Novo Deal detectado (${dealId}). Inserindo em NOVOS.`);
                try {
                    await prisma.$queryRaw`
                        INSERT INTO painel_arte_cards (empresa_id, bitrix_deal_id, coluna, posicao)
                        VALUES (${empresaId}, ${dealId}, 'NOVOS', 0)
                    `;
                } catch (dbErr) {
                    console.error(`[${reqId}] Erro ao inserir card ${dealId}:`, dbErr.message);
                }
            }

            mergedDeals.push({
                ...deal,
                coluna_local: coluna,
                posicao_local: posicao
            });
        }

        // Limpeza
        const bitrixIds = dealsBitrix.map(d => parseInt(d.ID));
        if (bitrixIds.length > 0) {
            await prisma.$queryRaw`
                DELETE FROM painel_arte_cards 
                WHERE empresa_id = ${empresaId} 
                AND NOT (bitrix_deal_id = ANY (${bitrixIds}))
            `;
        } else {
            console.log(`[${reqId}] Nenhum deal no Bitrix. Limpando tabela local.`);
            await prisma.$queryRaw`DELETE FROM painel_arte_cards WHERE empresa_id = ${empresaId}`;
        }

        // Ordenar
        mergedDeals.sort((a, b) => a.posicao_local - b.posicao_local);

        console.log(`[${reqId}] >>> CONCLUÍDO. Retornando ${mergedDeals.length} cards.`);
        return res.status(200).json({ deals: mergedDeals });

    } catch (error) {
        console.error(`[REQ-ERRO] Erro fatal em getBoardData:`, error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
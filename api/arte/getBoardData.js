// /api/arte/getBoardData.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const STAGE_ARTE = 'C17:UC_JHF0WH'; // Fase "Em Criação/Arte" no Bitrix

const SELECT_FIELDS = [
    'ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY',
    'UF_CRM_1741273407628', // Nome Cliente
    'UF_CRM_1749481565243', // Contato Cliente
    'UF_CRM_1761269158',    // Tipo de Arte (Freelancer/Setor de Arte)
    'UF_CRM_1752712769666', // Link Acompanhar (WhatsApp)
    'UF_CRM_1764429361',    // Link Falar com Designer
    'UF_CRM_1727464924690'  // Medidas
];

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken } = req.body;
        
        // 1. Auth e Empresa
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['ID', 'COMPANY_ID']
        });
        const user = userCheck.data.result ? userCheck.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(401).json({ message: 'Sessão inválida.' });

        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1`;
        if (!empresas.length) return res.status(403).json({ message: 'Empresa não encontrada.' });
        const empresaId = empresas[0].id;

        // 2. Buscar Deals no Bitrix (Fase de Arte)
        const bxResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: { 
                'CATEGORY_ID': 17, 
                'COMPANY_ID': user.COMPANY_ID,
                'STAGE_ID': STAGE_ARTE 
            },
            select: SELECT_FIELDS
        });
        const dealsBitrix = bxResponse.data.result || [];

        // 3. Buscar Estado Local (Colunas)
        const localCards = await prisma.$queryRaw`SELECT * FROM painel_arte_cards WHERE empresa_id = ${empresaId}`;
        const localMap = new Map(localCards.map(c => [c.bitrix_deal_id, c]));

        // 4. Merge e Sincronização
        const mergedDeals = [];

        for (const deal of dealsBitrix) {
            const dealId = parseInt(deal.ID);
            let coluna = 'NOVOS';
            let posicao = 9999;

            if (localMap.has(dealId)) {
                // Já existe no banco, usa a coluna salva
                const local = localMap.get(dealId);
                coluna = local.coluna;
                posicao = local.posicao;
            } else {
                // Novo no Bitrix, insere no Banco Local como NOVOS
                await prisma.$queryRaw`
                    INSERT INTO painel_arte_cards (empresa_id, bitrix_deal_id, coluna, posicao)
                    VALUES (${empresaId}, ${dealId}, 'NOVOS', 0)
                `;
            }

            mergedDeals.push({
                ...deal,
                coluna_local: coluna,
                posicao_local: posicao
            });
        }

        // Limpeza: Remove do banco local pedidos que não estão mais nessa fase no Bitrix
        // (Ex: foram aprovados ou cancelados fora do painel)
        const bitrixIds = dealsBitrix.map(d => parseInt(d.ID));
        if (bitrixIds.length > 0) {
            await prisma.$queryRaw`
                DELETE FROM painel_arte_cards 
                WHERE empresa_id = ${empresaId} 
                AND bitrix_deal_id NOT IN (${prisma.join(bitrixIds)})
            `;
        }

        // Ordenar
        mergedDeals.sort((a, b) => a.posicao_local - b.posicao_local);

        return res.status(200).json({ deals: mergedDeals });

    } catch (error) {
        console.error("Erro getArteBoard:", error);
        return res.status(500).json({ message: 'Erro ao carregar painel de arte.' });
    }
};
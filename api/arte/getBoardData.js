// /api/arte/getBoardData.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// --- CONFIGURAÇÃO DAS FASES ---

// Fase Estática (Designer Próprio): Onde o card "mora" no Bitrix enquanto brincamos com ele no Neon
const STAGE_DESIGNER_PROPRIO = 'C17:UC_JHF0WH';

// Fases Dinâmicas (Freelancers): Onde o Bitrix manda na coluna
const STAGES_FREELANCER = [
    'C17:UC_2OEE24',   // Em Análise
    'C17:PREPARATION', // Em Andamento
    'C17:UC_Y31VM3',   // Em Andamento (Variação)
    'C17:UC_HX3875'    // Aguardando Cliente
];

// Lista completa para o Filtro da API
const ALL_TARGET_STAGES = [STAGE_DESIGNER_PROPRIO, ...STAGES_FREELANCER];

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
    const reqId = `REQ-${Date.now()}`;
    console.log(`\n[${reqId}] >>> INICIANDO getBoardData (Lógica Híbrida)`);

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

        // 2. Buscar Deals no Bitrix (Filtro Específico)
        const filterBitrix = { 
            'CATEGORY_ID': 17, 
            'COMPANY_ID': user.COMPANY_ID,
            'STAGE_ID': ALL_TARGET_STAGES // Busca apenas as fases que você listou
        };
        
        const bxResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterBitrix,
            select: SELECT_FIELDS,
            order: { "ID": "DESC" }
        });
        
        const dealsBitrix = bxResponse.data.result || [];
        console.log(`[${reqId}] Bitrix retornou ${dealsBitrix.length} pedidos nas fases de Arte.`);

        // 3. Buscar Estado Local (Apenas para Designer Próprio ou persistência)
        const localCards = await prisma.$queryRaw`SELECT * FROM painel_arte_cards WHERE empresa_id = ${empresaId}`;
        const localMap = new Map(localCards.map(c => [c.bitrix_deal_id, c]));

        // 4. LÓGICA HÍBRIDA DE MAPEAMENTO
        const mergedDeals = [];

        for (const deal of dealsBitrix) {
            const dealId = parseInt(deal.ID);
            const stageId = deal.STAGE_ID;
            
            let colunaFinal = 'NOVOS'; // Padrão
            let posicaoFinal = 9999;

            // --- CASO 1: DESIGNER PRÓPRIO (Controle Local) ---
            if (stageId === STAGE_DESIGNER_PROPRIO) {
                if (localMap.has(dealId)) {
                    const local = localMap.get(dealId);
                    colunaFinal = local.coluna;
                    posicaoFinal = local.posicao;
                } else {
                    // Se chegou agora e é designer próprio, salva no banco como NOVOS
                    try {
                        await prisma.$queryRaw`
                            INSERT INTO painel_arte_cards (empresa_id, bitrix_deal_id, coluna, posicao)
                            VALUES (${empresaId}, ${dealId}, 'NOVOS', 0)
                            ON CONFLICT (bitrix_deal_id) DO NOTHING
                        `;
                    } catch (e) { console.error("Erro DB Insert:", e.message); }
                }
            } 
            // --- CASO 2: FREELANCER (Controle Bitrix) ---
            else {
                // Aqui mapeamos a FASE DO BITRIX para a COLUNA VISUAL DO PAINEL
                // Independente do que diz o banco de dados local
                
                if (stageId === 'C17:UC_2OEE24') {
                    colunaFinal = 'NOVOS'; // Em Análise -> Novos
                } 
                else if (stageId === 'C17:PREPARATION' || stageId === 'C17:UC_Y31VM3') {
                    colunaFinal = 'EM_ANDAMENTO'; // Preparation -> Em Andamento
                } 
                else if (stageId === 'C17:UC_HX3875') {
                    colunaFinal = 'AGUARDANDO_CLIENTE'; // Waiting Client -> Aguardando Cliente
                }
                
                // Nota: A coluna "AJUSTES" é exclusiva do fluxo manual interno, 
                // a menos que haja uma fase específica no Bitrix para isso.
                
                posicaoFinal = 0; // Freelancers ficam sempre no topo ou ordem padrão
            }

            mergedDeals.push({
                ...deal,
                coluna_local: colunaFinal,
                posicao_local: posicaoFinal
            });
        }

        // 5. Limpeza do Banco Local
        // Remove pedidos que saíram totalmente dessas fases (foram para impressão, cancelados, etc)
        const bitrixIds = dealsBitrix.map(d => parseInt(d.ID));
        if (bitrixIds.length > 0) {
            await prisma.$queryRaw`
                DELETE FROM painel_arte_cards 
                WHERE empresa_id = ${empresaId} 
                AND NOT (bitrix_deal_id = ANY (${bitrixIds}))
            `;
        } else {
            await prisma.$queryRaw`DELETE FROM painel_arte_cards WHERE empresa_id = ${empresaId}`;
        }

        // Ordenar
        mergedDeals.sort((a, b) => a.posicao_local - b.posicao_local);

        return res.status(200).json({ deals: mergedDeals });

    } catch (error) {
        console.error(`[${reqId}] Erro Fatal:`, error);
        return res.status(500).json({ message: 'Erro interno ao carregar painel.' });
    }
};
// /api/arte/getBoardData.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// --- CONFIGURAÇÃO DE MAPEAMENTO ---
// Define explicitamente para qual coluna cada fase do Bitrix vai
const STAGE_TO_COLUMN_MAP = {
    // Designer Próprio
    'C17:UC_JHF0WH': 'NOVOS',              

    // Freelancer / Setor de Arte (Novos requisitos)
    'C17:NEW': 'NOVOS',        
    'C17:UC_2OEE24': 'NOVOS',  
    
    // Fases de Andamento
    'C17:PREPARATION': 'EM_ANDAMENTO',
    'C17:UC_Y31VM3': 'EM_ANDAMENTO',
    'C17:UC_318C00': 'EM_ANDAMENTO',
    
    // Outras fases
    'C17:UC_5W020W': 'AJUSTES',            
    'C17:UC_HX3875': 'AGUARDANDO_CLIENTE',
    'C17:UC_HQSL5R': 'AGUARDANDO_CLIENTE'
};

const SELECT_FIELDS = [
    'ID', 'TITLE', 'STAGE_ID', 
    'UF_CRM_1741273407628', // Nome Cliente
    'UF_CRM_1749481565243', // Contato Cliente
    'UF_CRM_1761269158',    // Tipo de Arte
    'UF_CRM_1752712769666', // Link Acompanhar
    'UF_CRM_1764429361',    // Link Designer
    'UF_CRM_1727464924690'  // Medidas
];

module.exports = async (req, res) => {
    // Evita métodos incorretos
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

        // 1. Validar Usuário e Empresa
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const companyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Buscar Deals no Bitrix
        // Pegamos todas as chaves do mapa para filtrar no Bitrix
        const stagesToFetch = Object.keys(STAGE_TO_COLUMN_MAP);

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: {
                'COMPANY_ID': companyId,
                'STAGE_ID': stagesToFetch
            },
            select: SELECT_FIELDS,
            order: { 'ID': 'DESC' }
        });

        const deals = response.data.result || [];

        // 3. Processamento e Mapeamento
        const processedDeals = [];

        // Busca estado local para ordenação (se existir)
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(companyId)} LIMIT 1`;
        let localMap = new Map();
        
        if (empresas.length > 0) {
            const empresaId = empresas[0].id;
            const localCards = await prisma.$queryRaw`SELECT * FROM painel_arte_cards WHERE empresa_id = ${empresaId}`;
            localMap = new Map(localCards.map(c => [c.bitrix_deal_id, c]));
        }

        for (const deal of deals) {
            const stageId = deal.STAGE_ID;
            
            // Regra Mestra: O mapa define a coluna
            let colunaFinal = STAGE_TO_COLUMN_MAP[stageId] || 'NOVOS';
            
            // Se for Designer Próprio e já tiver sido movido localmente, respeita o local
            if (stageId === 'C17:UC_JHF0WH' && localMap.has(parseInt(deal.ID))) {
                colunaFinal = localMap.get(parseInt(deal.ID)).coluna;
            }

            processedDeals.push({
                ...deal,
                coluna_local: colunaFinal
            });
        }

        return res.status(200).json({ deals: processedDeals });

    } catch (error) {
        console.error("Erro getBoardData:", error);
        return res.status(500).json({ message: 'Erro interno ao buscar dados.' });
    }
};
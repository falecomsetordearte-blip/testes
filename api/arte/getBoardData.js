// /api/arte/getBoardData.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento de Fases x Colunas do Kanban Local
const STAGE_MAPPING = {
    // Fases Normais de Arte
    'C17:UC_JHF0WH': 'NOVOS',              // Designer Próprio (Início)
    'C17:UC_318C00': 'EM_ANDAMENTO',       // Em Produção
    'C17:UC_5W020W': 'AJUSTES',            // Ajustes
    'C17:UC_HQSL5R': 'AGUARDANDO_CLIENTE', // Aguardando Aprovação
    
    // NOVAS FASES (O "purple" card)
    'C17:NEW': 'NOVOS',        // Freelancer (Em Análise)
    'C17:UC_2OEE24': 'NOVOS'   // Pago (Em Análise)
};

const FIELD_COLUNA_LOCAL = 'coluna_local'; // Apenas auxiliar, não vai pro Bitrix

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

        // 1. Validar Usuário/Empresa
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const companyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Buscar Deals no Bitrix
        // Pegamos todas as chaves do objeto STAGE_MAPPING
        const stagesToFetch = Object.keys(STAGE_MAPPING);

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: {
                'COMPANY_ID': companyId,
                'STAGE_ID': stagesToFetch // Busca todas as fases mapeadas
            },
            select: [
                'ID', 'TITLE', 'STAGE_ID', 
                'UF_CRM_1761269158', // Tipo de Arte
                'UF_CRM_1752712769666', // Link Acompanhar
                'UF_CRM_1764429361', // Link Designer
                'UF_CRM_1727464924690', // Medidas
                'UF_CRM_1741273407628'  // Nome Cliente
            ],
            order: { 'ID': 'DESC' }
        });

        const deals = response.data.result || [];

        // 3. Processar para o Frontend
        const processedDeals = deals.map(d => ({
            ...d,
            // Adiciona a propriedade 'coluna_local' baseada no mapa
            [FIELD_COLUNA_LOCAL]: STAGE_MAPPING[d.STAGE_ID] || 'NOVOS'
        }));

        return res.status(200).json({ deals: processedDeals });

    } catch (error) {
        console.error("Erro getBoardData:", error);
        return res.status(500).json({ message: 'Erro ao buscar dados do quadro.' });
    }
};
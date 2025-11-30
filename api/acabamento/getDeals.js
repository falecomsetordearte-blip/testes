// /api/acabamento/getDeals.js
const prisma = require('../../lib/prisma'); // Necessário para pegar o ID local
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_STATUS_IMPRESSAO = 'UF_CRM_1757756651931';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_CONTATO_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_LINK_ATENDIMENTO = 'UF_CRM_1752712769666';
const FIELD_MEDIDAS = 'UF_CRM_1727464924690';
const FIELD_LINK_ARQUIVO_FINAL = 'UF_CRM_1748277308731';
const FIELD_REVISAO_SOLICITADA = 'UF_CRM_1757765731136';
const FIELD_STATUS_PAGAMENTO_DESIGNER = 'UF_CRM_1757789502613';
const FIELD_PRAZO_FINAL = 'UF_CRM_1757794109';
const FIELD_BRIEFING = 'UF_CRM_1738249371'; // Campo Briefing Adicionado

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;

        if (!sessionToken) {
            return res.status(401).json({ message: 'Acesso não autorizado. Token de sessão é obrigatório.' });
        }

        // 1. Identificar User no Bitrix
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userSearch.data.result ? userSearch.data.result[0] : null;
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }

        // 2. Descobrir o ID Local da Empresa (Para regra do botão 4 e 24)
        const empresasLocais = await prisma.$queryRaw`
            SELECT id FROM empresas 
            WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} 
            LIMIT 1
        `;
        const localCompanyId = empresasLocais.length > 0 ? empresasLocais[0].id : 0;

        // 3. Buscar Deals no Bitrix
        const filterParams = {
            'STAGE_ID': 'C17:UC_QA8TN5', // Fase de Acabamento
            'COMPANY_ID': user.COMPANY_ID
        };

        if (impressoraFilter) filterParams[FIELD_IMPRESSORA] = impressoraFilter;
        if (materialFilter) filterParams[FIELD_MATERIAL] = materialFilter;

        console.log('[getAcabamentoDeals] Iniciando busca...');

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: [
                'ID', 'TITLE', 'STAGE_ID', 'ASSIGNED_BY_ID',
                FIELD_STATUS_IMPRESSAO, FIELD_NOME_CLIENTE, FIELD_CONTATO_CLIENTE,
                FIELD_LINK_ATENDIMENTO, FIELD_MEDIDAS, FIELD_LINK_ARQUIVO_FINAL,
                FIELD_REVISAO_SOLICITADA,
                FIELD_STATUS_PAGAMENTO_DESIGNER,
                FIELD_PRAZO_FINAL,
                FIELD_BRIEFING // Incluindo o briefing
            ]
        });

        const deals = response.data.result || [];
        
        console.log(`[getAcabamentoDeals] ${deals.length} negócios encontrados. ID Local: ${localCompanyId}`);
        
        return res.status(200).json({ 
            deals: deals,
            localCompanyId: localCompanyId
        });

    } catch (error) {
        console.error('[getAcabamentoDeals] Erro:', error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
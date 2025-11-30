// /api/impressao/getDeals.js
const prisma = require('../../lib/prisma'); // Necessário para pegar o ID local (4 ou 24)
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Campos do Bitrix
const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_STATUS_IMPRESSAO = 'UF_CRM_1757756651931';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_CONTATO_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_LINK_ATENDIMENTO = 'UF_CRM_1752712769666';
const FIELD_MEDIDAS = 'UF_CRM_1727464924690';
const FIELD_LINK_ARQUIVO_FINAL = 'UF_CRM_1748277308731';
const FIELD_PRAZO_FINAL = 'UF_CRM_1757794109';
const FIELD_BRIEFING = 'UF_CRM_1738249371'; // Campo Briefing Adicionado

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;

        if (!sessionToken) return res.status(401).json({ message: 'Token obrigatório.' });

        // 1. Identificar User no Bitrix
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });
        const user = searchUserResponse.data.result ? searchUserResponse.data.result[0] : null;

        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // 2. Descobrir o ID Local da Empresa (Para regra do botão 4 e 24)
        const empresasLocais = await prisma.$queryRaw`
            SELECT id FROM empresas 
            WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} 
            LIMIT 1
        `;
        
        // Se não achar no banco local, define como 0 para não quebrar a lógica, 
        // mas idealmente deveria achar.
        const localCompanyId = empresasLocais.length > 0 ? empresasLocais[0].id : 0;

        // 3. Buscar Deals no Bitrix
        const filterParams = {
            'STAGE_ID': 'C17:UC_ZHMX6W', // Fase de Produção/Impressão
            'COMPANY_ID': user.COMPANY_ID
        };

        if (impressoraFilter) filterParams[FIELD_IMPRESSORA] = impressoraFilter;
        if (materialFilter) filterParams[FIELD_MATERIAL] = materialFilter;

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: [
                'ID', 'TITLE', 'STAGE_ID',
                FIELD_STATUS_IMPRESSAO, FIELD_NOME_CLIENTE, FIELD_CONTATO_CLIENTE,
                FIELD_LINK_ATENDIMENTO, FIELD_MEDIDAS, FIELD_LINK_ARQUIVO_FINAL,
                FIELD_PRAZO_FINAL, FIELD_BRIEFING // Adicionado aqui
            ]
        });

        const deals = response.data.result || [];
        
        // Retorna os deals E o ID local da empresa
        return res.status(200).json({ 
            deals: deals,
            localCompanyId: localCompanyId 
        });

    } catch (error) {
        console.error('[getDeals] Erro:', error.message);
        return res.status(500).json({ message: 'Erro ao buscar dados.' });
    }
};
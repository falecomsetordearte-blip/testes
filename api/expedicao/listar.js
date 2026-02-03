// api/expedicao/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const FASES_ALVO = [
    'C17:UC_IKPW6X', // Finalizado/Entregue
    'C17:UC_WFTT1A', // Pago
    'C17:UC_G2024K'  // Devedor
];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, query } = req.body;
        if (!sessionToken) return res.status(403).json({ message: 'Não autorizado' });

        // 1. Identificar Usuário no Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({ message: 'Sessão inválida' });
        const user = userCheck.data.result[0];
        
        // 2. Descobrir o ID Local da Empresa (Regra de Ouro)
        const empresasLocais = await prisma.$queryRawUnsafe(
            `SELECT id FROM empresas WHERE bitrix_company_id = $1 LIMIT 1`, 
            parseInt(user.COMPANY_ID)
        );
        const localCompanyId = empresasLocais.length > 0 ? empresasLocais[0].id : 0;

        // 3. Buscar Deals no Bitrix
        let bitrixFilter = { 'COMPANY_ID': user.COMPANY_ID, 'STAGE_ID': FASES_ALVO };
        if (query && !isNaN(parseInt(query))) bitrixFilter['ID'] = parseInt(query);

        const bitrixResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: bitrixFilter,
            select: ['ID', 'TITLE', 'STAGE_ID'], 
            order: { 'ID': 'DESC' }
        });

        const dealsBitrix = bitrixResponse.data.result || [];
        if (dealsBitrix.length === 0) return res.status(200).json({ deals: [], localCompanyId });

        const dealIds = dealsBitrix.map(d => parseInt(d.ID));

        // 4. Buscar dados financeiros e briefing no banco local
        const dadosLocais = await prisma.$queryRawUnsafe(
            `SELECT id, bitrix_deal_id, titulo, nome_cliente, whatsapp_cliente, briefing_completo, status_expedicao, valor_pago, valor_restante 
             FROM pedidos 
             WHERE bitrix_deal_id IN (${dealIds.join(',')})`
        );

        const resultadoFinal = dealsBitrix.map(deal => {
            const local = dadosLocais.find(l => Number(l.bitrix_deal_id) === Number(deal.ID));

            return {
                id_bitrix: parseInt(deal.ID),
                id_interno: local ? local.id : null, 
                titulo: local?.titulo || deal.TITLE,
                nome_cliente: local?.nome_cliente || 'Cliente não sincronizado',
                whatsapp: local?.whatsapp_cliente || '-',
                briefing: local?.briefing_completo || 'Sem briefing registrado.',
                status_expedicao: local?.status_expedicao || 'Aguardando Retirada',
                valor_pago: parseFloat(local?.valor_pago || 0),
                valor_restante: parseFloat(local?.valor_restante || 0)
            };
        });

        return res.status(200).json({ 
            deals: resultadoFinal, 
            localCompanyId: localCompanyId 
        });

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro ao listar dados.' });
    }
};
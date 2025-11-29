// /api/arte/updateStatus.js
const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const STAGE_IMPRESSAO = 'C17:UC_ZHMX6W'; // Destino quando aprovado

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, dealId, action } = req.body; // action: 'AJUSTES' ou 'APROVADO'

        // 1. Auth
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['COMPANY_ID']
        });
        const user = userCheck.data.result ? userCheck.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(401).json({ message: 'Sessão inválida.' });

        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1`;
        const empresaId = empresas[0].id;

        if (action === 'AJUSTES') {
            // Move card localmente para a coluna AJUSTES
            await prisma.$queryRaw`
                UPDATE painel_arte_cards 
                SET coluna = 'AJUSTES', updated_at = NOW()
                WHERE bitrix_deal_id = ${parseInt(dealId)} AND empresa_id = ${empresaId}
            `;
            return res.status(200).json({ success: true, message: 'Pedido movido para Ajustes.', movedToNextStage: false });
        } 
        
        else if (action === 'APROVADO') {
            // Move fase no Bitrix para Impressão
            await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
                id: dealId,
                fields: { 'STAGE_ID': STAGE_IMPRESSAO }
            });

            // Remove do controle local (pois saiu da fase de arte)
            await prisma.$queryRaw`
                DELETE FROM painel_arte_cards 
                WHERE bitrix_deal_id = ${parseInt(dealId)} AND empresa_id = ${empresaId}
            `;

            return res.status(200).json({ success: true, message: 'Arte aprovada! Enviado para impressão.', movedToNextStage: true });
        }

        return res.status(400).json({ message: 'Ação inválida.' });

    } catch (error) {
        console.error("Erro updateStatus:", error);
        return res.status(500).json({ message: 'Erro ao processar ação.' });
    }
};
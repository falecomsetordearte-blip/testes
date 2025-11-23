// /api/crm/deleteCard.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, cardId } = req.body;

        // 1. Autenticação
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({ message: 'Auth Error' });
        
        const bitrixId = userCheck.data.result[0].COMPANY_ID;
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_id = ${bitrixId} LIMIT 1`;
        const empresaId = empresas[0].id;

        // 2. Deletar
        await prisma.$queryRaw`
            DELETE FROM crm_oportunidades 
            WHERE id = ${parseInt(cardId)} AND empresa_id = ${empresaId}
        `;

        return res.status(200).json({ success: true });

    } catch (error) {
        return res.status(500).json({ message: 'Erro ao deletar' });
    }
};
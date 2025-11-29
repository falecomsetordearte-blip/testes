// /api/crm/getBalance.js
const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        const { sessionToken } = req.body;
        
        // 1. Pega ID da Empresa no Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['COMPANY_ID']
        });
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({ saldo: 0 });
        const companyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Pega Saldo no Neon
        const empresas = await prisma.$queryRaw`
            SELECT saldo FROM empresas WHERE bitrix_company_id = ${parseInt(companyId)} LIMIT 1
        `;

        if (!empresas.length) return res.status(200).json({ saldo: 0 });

        return res.status(200).json({ saldo: parseFloat(empresas[0].saldo) });

    } catch (error) {
        console.error("Erro getBalance:", error);
        return res.status(500).json({ saldo: 0 });
    }
};
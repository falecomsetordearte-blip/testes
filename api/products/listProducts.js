const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken } = req.body;

        // 1. Auth Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Auth Error' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Busca Empresa ID
        const empresas = await prisma.$queryRaw`
            SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1
        `;

        if (!empresas.length) return res.status(404).json([]);
        const empresaId = empresas[0].id;

        // 3. Lista Produtos
        const produtos = await prisma.produto.findMany({
            where: { empresa_id: empresaId },
            orderBy: { nome: 'asc' },
            select: {
                id: true,
                nome: true,
                prazo_producao: true,
                tipo_calculo: true,
                preco_base: true
            }
        });

        return res.status(200).json(produtos);

    } catch (error) {
        console.error("Erro listProducts:", error);
        return res.status(500).json([]);
    }
};
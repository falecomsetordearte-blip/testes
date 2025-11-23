const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, query } = req.body;

        if (!query || query.length < 2) return res.status(200).json([]); // Só busca se tiver 2+ letras

        // 1. Identificar Empresa Logada no Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json([]);
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        
        // 2. Buscar Empresa no Neon (USANDO A COLUNA NOVA)
        // --- CORREÇÃO AQUI ---
        const empresas = await prisma.$queryRaw`
            SELECT id 
            FROM empresas 
            WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} 
            LIMIT 1
        `;

        if (!empresas.length) return res.status(404).json([]);
        
        const empresaId = empresas[0].id;

        // 3. Buscar Clientes (Nome ou WhatsApp)
        const termo = `%${query}%`;
        
        const clientes = await prisma.$queryRaw`
            SELECT id, nome, whatsapp 
            FROM crm_clientes 
            WHERE empresa_id = ${empresaId} 
            AND (nome ILIKE ${termo} OR whatsapp ILIKE ${termo})
            LIMIT 5
        `;

        return res.status(200).json(clientes);

    } catch (error) {
        console.error("Erro searchClients:", error);
        return res.status(500).json([]);
    }
};
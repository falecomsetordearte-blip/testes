// /api/crm/searchClients.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, query } = req.body;

        if (!query || query.length < 2) return res.status(200).json([]);

        // 1. Autenticação Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        
        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json([]);
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        
        // 2. Busca Empresa no Neon
        const empresas = await prisma.$queryRaw`
            SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1
        `;

        if (!empresas.length) return res.status(404).json([]);
        const empresaId = empresas[0].id;

        // 3. Tratamento da Busca (Limpeza de strings)
        // Remove tudo que não for letra ou número para busca geral
        const termoLimpo = query.trim(); 
        // Remove tudo que não for número para busca de telefone
        const termoNumerico = query.replace(/\D/g, ''); 

        // Query SQL:
        // - Nome: ILIKE (Case insensitive)
        // - WhatsApp: Removemos caracteres não numéricos do banco para comparar com o termo numérico
        const clientes = await prisma.$queryRaw`
            SELECT id, nome, whatsapp 
            FROM crm_clientes 
            WHERE empresa_id = ${empresaId} 
            AND (
                nome ILIKE ${'%' + termoLimpo + '%'} 
                OR 
                REGEXP_REPLACE(whatsapp, '\\D', '', 'g') ILIKE ${'%' + termoNumerico + '%'}
            )
            LIMIT 5
        `;

        return res.status(200).json(clientes);

    } catch (error) {
        console.error("Erro searchClients:", error);
        return res.status(500).json([]);
    }
};
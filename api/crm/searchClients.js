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

        // Validação básica
        if (!query || query.trim().length === 0) return res.status(200).json([]);

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

        // 3. Tratamento da Busca (CORREÇÃO DA LÓGICA)
        // Remove espaços extras
        const termoLimpo = query.trim(); 
        
        // Remove tudo que não for número
        const termoNumerico = query.replace(/\D/g, ''); 

        // IMPORTANTE: Lógica para impedir retorno de todos os dados
        // Se houver números na busca, buscamos no WhatsApp usando ILIKE.
        // Se NÃO houver números, usamos '__nomatch__' para garantir que a parte do OR do telefone seja falsa.
        const buscaTelefone = termoNumerico.length > 0 ? '%' + termoNumerico + '%' : '__nomatch__';
        
        // Busca por nome é sempre feita
        const buscaNome = '%' + termoLimpo + '%';

        // Query SQL
        const clientes = await prisma.$queryRaw`
            SELECT id, nome, whatsapp 
            FROM crm_clientes 
            WHERE empresa_id = ${empresaId} 
            AND (
                nome ILIKE ${buscaNome} 
                OR 
                REGEXP_REPLACE(whatsapp, '\\D', '', 'g') ILIKE ${buscaTelefone}
            )
            ORDER BY nome ASC
            LIMIT 20
        `;

        return res.status(200).json(clientes);

    } catch (error) {
        console.error("Erro searchClients:", error);
        return res.status(500).json([]);
    }
};
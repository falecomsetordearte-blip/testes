const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Permite CORS (Importante para o front não bloquear)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(401).json({ message: 'Token não fornecido' });

        // 1. Validar Token no Bitrix e pegar ID da Empresa
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || userCheck.data.result.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Busca a empresa no Neon usando a NOVA coluna "bitrix_company_id"
        // --- CORREÇÃO AQUI ---
        const empresas = await prisma.$queryRaw`
            SELECT id 
            FROM empresas 
            WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} 
            LIMIT 1
        `;
        
        if (empresas.length === 0) {
            console.error(`[listCards] Empresa ID ${bitrixCompanyId} não encontrada.`);
            return res.status(404).json({ message: 'Empresa não encontrada no banco local.' });
        }
        
        const empresaId = empresas[0].id;

        // 3. Buscar os cards dessa empresa
        const cards = await prisma.$queryRaw`
            SELECT * FROM crm_oportunidades 
            WHERE empresa_id = ${empresaId} 
            ORDER BY posicao ASC, updated_at DESC
        `;

        // Formata valores numéricos e JSON para o Frontend
        const cardsFormatados = cards.map(c => ({
            ...c,
            valor_orcamento: parseFloat(c.valor_orcamento),
            // Garante que o JSON seja um objeto, mesmo se o banco retornar string
            briefing_json: typeof c.briefing_json === 'string' ? JSON.parse(c.briefing_json) : c.briefing_json
        }));

        return res.status(200).json(cardsFormatados);

    } catch (error) {
        console.error("Erro listCards:", error);
        return res.status(500).json({ message: 'Erro interno ao listar cards.' });
    }
};
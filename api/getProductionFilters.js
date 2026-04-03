// /api/getProductionFilters.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_TIPO_ENTREGA = 'UF_CRM_1658492661';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sessionToken = req.body.sessionToken;

        let empresaId = null;
        if (sessionToken) {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (empresas.length > 0) empresaId = empresas[0].id;
            else {
                const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
                if (users.length > 0) empresaId = users[0].empresa_id;
            }
        }

        const response = await axios.get(`${BITRIX24_API_URL}crm.deal.fields.json`);
        const allFields = response.data.result;

        const materialOptions = allFields[FIELD_MATERIAL]?.items || [];
        const tipoEntregaOptions = allFields[FIELD_TIPO_ENTREGA]?.items || [];

        let impressorasLocais = [];
        if (empresaId) {
            impressorasLocais = await prisma.$queryRawUnsafe(`
                SELECT id, nome as value FROM impressoras 
                WHERE empresa_id = $1 AND ativo = true ORDER BY nome ASC
            `, empresaId);
        }

        const filters = {
            impressoras: impressorasLocais,
            materiais: materialOptions.map(item => ({ id: item.ID, value: item.VALUE })),
            tiposEntrega: tipoEntregaOptions.map(item => ({ id: item.ID, value: item.VALUE }))
        };
        
        return res.status(200).json(filters);

    } catch (error) {
        console.error('[getProductionFilters] Erro ao buscar opções de filtros:', error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os filtros.' });
    }
};
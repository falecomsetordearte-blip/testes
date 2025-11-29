// api/expedicao/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, query } = req.body;
        
        if (!sessionToken) return res.status(403).json({ message: 'Não autorizado' });

        // 1. SEGURANÇA: Validar Token e obter Empresa
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        const empresas = await prisma.$queryRawUnsafe(
            `SELECT id FROM empresas WHERE bitrix_company_id = $1 LIMIT 1`, 
            parseInt(bitrixCompanyId)
        );

        if (empresas.length === 0) return res.status(404).json({ message: 'Empresa não encontrada.' });
        const empresaId = empresas[0].id;

        // 2. QUERY COM FILTRO DE FASES E EMPRESA
        
        // Fases permitidas
        const fasesPermitidas = "'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K'";

        let sqlQuery;
        let params = [];

        if (query && query.trim().length > 0) {
            const termo = query.trim();
            const termoNumero = parseInt(termo); 
            const termoTexto = `%${termo}%`;

            if (!isNaN(termoNumero)) {
                // Busca por ID + Empresa + Fases
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE empresa_id = $1 
                    AND bitrix_stage_id IN (${fasesPermitidas})
                    AND (
                        id = $2 
                        OR nome_cliente ILIKE $3 
                        OR titulo_automatico ILIKE $3
                        OR wpp_cliente ILIKE $3
                    )
                    ORDER BY id DESC LIMIT 50
                `;
                params = [empresaId, termoNumero, termoTexto];
            } else {
                // Busca por Texto + Empresa + Fases
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE empresa_id = $1
                    AND bitrix_stage_id IN (${fasesPermitidas})
                    AND (
                        nome_cliente ILIKE $2 
                        OR titulo_automatico ILIKE $2
                        OR wpp_cliente ILIKE $2
                        OR servico_tipo ILIKE $2
                    )
                    ORDER BY id DESC LIMIT 50
                `;
                params = [empresaId, termoTexto];
            }
        } else {
            // Sem busca: Apenas Filtro Base (Empresa + Fases)
            sqlQuery = `
                SELECT * FROM pedidos 
                WHERE empresa_id = $1
                AND bitrix_stage_id IN (${fasesPermitidas})
                ORDER BY id DESC LIMIT 50
            `;
            params = [empresaId];
        }

        const pedidos = await prisma.$queryRawUnsafe(sqlQuery, ...params);
        
        const pedidosFormatados = pedidos.map(p => ({
            ...p,
            id: Number(p.id),
            valor_orcamento: parseFloat(p.valor_orcamento || p.valor || 0), 
            status_expedicao: p.status_expedicao || 'Aguardando Retirada'
        }));

        return res.status(200).json(pedidosFormatados);

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro interno ao buscar pedidos' });
    }
};
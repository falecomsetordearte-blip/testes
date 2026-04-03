// /api/getOrderDetails.js
const prisma = require('../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Configuração CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { sessionToken, orderId } = req.body;

        if (!sessionToken || !orderId) {
            return res.status(400).json({ message: 'Token ou ID do pedido ausentes.' });
        }

        // 1. Autenticar Usuário no Bitrix
        const authResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });
        const user = authResponse.data.result ? authResponse.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(403).json({ message: 'Acesso negado.' });

        // 2. Buscar ID da empresa no Neon
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_id = ${user.ID} LIMIT 1`;
        if (empresas.length === 0) return res.status(403).json({ message: 'Empresa não encontrada.' });
        const empresaId = empresas[0].id;

        // 3. Buscar Pedido no Banco de Dados (Garante que o pedido pertence a essa empresa)
        // Usamos queryRaw para garantir compatibilidade imediata
        const pedidos = await prisma.$queryRaw`
            SELECT * FROM pedidos 
            WHERE bitrix_deal_id = ${parseInt(orderId)} 
            AND empresa_id = ${empresaId} 
            LIMIT 1
        `;

        if (pedidos.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou acesso não autorizado.' });
        }

        const pedidoDB = pedidos[0];

        // 4. Buscar Status Atualizado no Bitrix
        let statusAtual = 'Desconhecido';
        try {
            const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: pedidoDB.bitrix_deal_id });
            if (dealResponse.data.result) {
                statusAtual = dealResponse.data.result.STAGE_ID;
            }
        } catch (error) {
            console.error("Erro ao buscar status no Bitrix:", error.message);
        }

        // 5. Retornar tudo
        return res.status(200).json({
            success: true,
            pedido: pedidoDB,
            statusBitrix: statusAtual
        });

    } catch (error) {
        console.error("Erro API getOrderDetails:", error);
        return res.status(500).json({ message: 'Erro interno ao buscar pedido.' });
    }
};
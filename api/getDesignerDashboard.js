// /api/getDesignerDashboard.js

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { token } = req.body;
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);
        if (!designerId) return res.status(401).json({ message: 'ID do designer inválido.' });

        // ETAPA 1: Buscar dados financeiros e pedidos do Bitrix em paralelo
        const [financeiro, dealsResponse] = await Promise.all([
            // Busca no nosso banco de dados
            prisma.designerFinanceiro.findUnique({ where: { designer_id: designerId } }),
            
            // Busca no Bitrix24
            axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
                filter: { 
                    'ASSIGNED_BY_ID': designerId,
                    'CATEGORY_ID': [17, 31] // Busca nos pipelines C17 e C31
                },
                order: { 'ID': 'DESC' },
                select: ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CATEGORY_ID', 'DATE_CREATE']
            })
        ]);

        const allDeals = dealsResponse.data.result || [];

        // ETAPA 2: Processar e separar os dados
        const pedidosArte = allDeals.filter(d => d.CATEGORY_ID == 17);
        const solicitacoesSaque = allDeals.filter(d => d.CATEGORY_ID == 31);
        
        const pedidosAtivosCount = pedidosArte.filter(d => 
            !d.STAGE_ID.includes('WON') && 
            !d.STAGE_ID.includes('LOSE') && 
            d.STAGE_ID !== 'C17:1'
        ).length;

        // ETAPA 3: Montar a resposta completa
        res.status(200).json({
            saldoDisponivel: financeiro?.saldo_disponivel || 0,
            saldoPendente: financeiro?.saldo_pendente || 0,
            pedidosAtivos: pedidosAtivosCount,
            pedidosArte: pedidosArte,
            solicitacoesSaque: solicitacoesSaque
        });

    } catch (error) {
        console.error('Erro ao buscar dados da dashboard do designer:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Ocorreu um erro ao carregar os dados.' });
    }
};

// /api/getGlobalNotifications.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // CORS padrão
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Permitir opcionalmente buscar todas (incluindo inativas) se for o admin que bater
    const isAdmin = req.query.admin === 'true';

    try {
        let whereClause = { ativa: true };
        if (isAdmin) {
            whereClause = {}; // Admin quer ver todas
        }

        const notificacoes = await prisma.notificacaoGlobal.findMany({
            where: whereClause,
            orderBy: { criado_em: 'desc' },
            take: isAdmin ? 50 : 5 // Limitando para admin tb
        });

        return res.status(200).json(notificacoes);

    } catch (error) {
        console.error("Erro notificacoes:", error);
        return res.status(500).json([]);
    } finally {
        await prisma.$disconnect();
    }
};
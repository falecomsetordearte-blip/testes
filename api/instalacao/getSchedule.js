// /api/instalacao/getSchedule.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const schedules = await prisma.$queryRawUnsafe(`
            SELECT bitrix_deal_id, start_time, end_time, instaladores 
            FROM instalacao_agendamentos
        `);

        return res.status(200).json({ schedules });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao buscar agenda.' });
    }
};
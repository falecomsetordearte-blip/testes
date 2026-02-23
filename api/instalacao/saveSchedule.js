// /api/instalacao/saveSchedule.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { dealId, startTime, endTime, instaladores } = req.body;

        await prisma.$executeRawUnsafe(`
            INSERT INTO instalacao_agendamentos (bitrix_deal_id, start_time, end_time, instaladores, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (bitrix_deal_id) 
            DO UPDATE SET 
                start_time = EXCLUDED.start_time, 
                end_time = EXCLUDED.end_time, 
                instaladores = EXCLUDED.instaladores,
                updated_at = NOW()
        `, parseInt(dealId), new Date(startTime), new Date(endTime), instaladores);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro ao salvar agendamento.' });
    }
};
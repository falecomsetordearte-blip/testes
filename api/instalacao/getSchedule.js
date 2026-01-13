const prisma = require('../../lib/prisma');

module.exports = async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        // Busca todos os agendamentos
        const schedules = await prisma.$queryRaw`
            SELECT bitrix_deal_id, start_time, end_time, instaladores 
            FROM instalacao_agendamentos
        `;

        return res.status(200).json({ schedules });
    } catch (error) {
        console.error("Erro getSchedule:", error);
        return res.status(500).json({ message: 'Erro ao buscar agendamentos.' });
    }
};
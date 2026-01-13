const prisma = require('../../lib/prisma');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { dealId, startTime, endTime, instaladores } = req.body;

        if (!dealId || !startTime || !endTime) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        // Verifica se já existe agendamento para este Deal
        const existing = await prisma.$queryRaw`
            SELECT id FROM instalacao_agendamentos WHERE bitrix_deal_id = ${parseInt(dealId)} LIMIT 1
        `;

        if (existing.length > 0) {
            // Atualiza
            await prisma.$queryRaw`
                UPDATE instalacao_agendamentos 
                SET start_time = ${new Date(startTime)}, 
                    end_time = ${new Date(endTime)}, 
                    instaladores = ${instaladores},
                    updated_at = NOW()
                WHERE bitrix_deal_id = ${parseInt(dealId)}
            `;
        } else {
            // Cria
            await prisma.$queryRaw`
                INSERT INTO instalacao_agendamentos (bitrix_deal_id, start_time, end_time, instaladores)
                VALUES (${parseInt(dealId)}, ${new Date(startTime)}, ${new Date(endTime)}, ${instaladores})
            `;
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro saveSchedule:", error);
        return res.status(500).json({ message: 'Erro ao salvar agendamento.' });
    }
};
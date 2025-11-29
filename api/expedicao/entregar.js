// api/expedicao/entregar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, id } = req.body;
        if (!sessionToken || !id) return res.status(400).json({ message: 'Dados incompletos' });

        await prisma.crm_oportunidades.update({
            where: { id: parseInt(id) },
            data: {
                status_expedicao: 'Entregue',
                data_entrega: new Date()
            }
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro Expedição Entregar:", error);
        return res.status(500).json({ message: 'Erro ao atualizar status' });
    }
};
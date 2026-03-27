// /api/createGlobalNotification.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { titulo, mensagem, tipo } = req.body;

    try {
        await prisma.notificacaoGlobal.create({
            data: {
                titulo,
                mensagem,
                tipo: tipo || 'info',
                ativa: true
            }
        });
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Erro createGlobalNotification:", error);
        return res.status(500).json({ error: error.message });
    } finally {
        await prisma.$disconnect();
    }
};
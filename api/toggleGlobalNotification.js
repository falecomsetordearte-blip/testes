// /api/toggleGlobalNotification.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // CORS padrão
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { id, ativa, senha_admin } = req.body;

    if (senha_admin !== 'admin123') {
        return res.status(403).json({ message: 'Senha de administrador incorreta.' });
    }

    try {
        const updated = await prisma.notificacaoGlobal.update({
            where: { id: parseInt(id) },
            data: { ativa: ativa }
        });
        return res.status(200).json({ success: true, notificacao: updated });
    } catch (error) {
        console.error("Erro ao toggle notificacao:", error);
        return res.status(500).json({ message: 'Erro ao atualizar notificação.', error: error.message });
    } finally {
        await prisma.$disconnect();
    }
};

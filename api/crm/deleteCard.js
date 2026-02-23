const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, cardId } = req.body;

        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Auth Error' });

        await prisma.$executeRawUnsafe(`
            DELETE FROM crm_oportunidades 
            WHERE id = $1 AND empresa_id = $2
        `, parseInt(cardId), empresas[0].id);

        return res.status(200).json({ success: true });

    } catch (error) {
        return res.status(500).json({ message: 'Erro ao deletar' });
    }
};
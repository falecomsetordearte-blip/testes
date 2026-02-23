const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, cardId, novaColuna } = req.body;

        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Auth Error' });
        const empresaId = empresas[0].id;

        await prisma.$executeRawUnsafe(`
            UPDATE crm_oportunidades 
            SET coluna = $1, updated_at = NOW()
            WHERE id = $2 AND empresa_id = $3
        `, novaColuna, parseInt(cardId), empresaId);

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro moveCard:", error);
        return res.status(500).json({ message: 'Erro ao mover card' });
    }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken } = req.body;
        
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT saldo FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(200).json({ saldo: 0 });

        return res.status(200).json({ saldo: parseFloat(empresas[0].saldo) });

    } catch (error) {
        return res.status(500).json({ saldo: 0 });
    }
};
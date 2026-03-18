const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken } = req.body;
        
        let empresaId = null;
        let saldoDaEmpresa = 0;

        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, e.saldo 
            FROM painel_usuarios u
            JOIN empresas e ON u.empresa_id = e.id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if(users.length > 0) {
            empresaId = users[0].empresa_id;
            saldoDaEmpresa = parseFloat(users[0].saldo || 0);
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id, saldo FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
                saldoDaEmpresa = parseFloat(empresasLegacy[0].saldo || 0);
            }
        }

        if (!empresaId) return res.status(200).json({ saldo: 0 });

        return res.status(200).json({ saldo: saldoDaEmpresa });

    } catch (error) {
        return res.status(500).json({ saldo: 0 });
    }
};
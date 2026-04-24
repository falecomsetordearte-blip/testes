const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, query } = req.body;
        if (!query || query.trim().length === 0) return res.status(200).json([]);

        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresas = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresas.length > 0) {
                empresaId = empresas[0].id;
            }
        }

        if (!empresaId) return res.status(403).json([]);

        const termoLimpo = query.trim(); 
        const termoNumerico = query.replace(/\D/g, ''); 
        const buscaTelefone = termoNumerico.length > 0 ? '%' + termoNumerico + '%' : '__nomatch__';
        const buscaNome = '%' + termoLimpo + '%';

        const clientes = await prisma.$queryRawUnsafe(`
            SELECT id, nome, whatsapp 
            FROM crm_clientes 
            WHERE empresa_id = $1 
            AND (
                nome ILIKE $2 
                OR 
                REGEXP_REPLACE(whatsapp, '\\D', '', 'g') ILIKE $3
            )
            ORDER BY nome ASC
            LIMIT 20
        `, empresaId, buscaNome, buscaTelefone);
 
        return res.status(200).json(clientes);

    } catch (error) {
        return res.status(500).json([]);
    }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, nome, whatsapp } = req.body;

        if (!sessionToken) return res.status(401).json({ message: 'Token não fornecido' });
        if (!nome || !whatsapp) return res.status(400).json({ message: 'Nome e WhatsApp são obrigatórios' });

        // Identificar Empresa pelo Token
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) return res.status(403).json({ message: 'Sessão inválida' });

        // Upsert do Cliente (Usa WhatsApp como chave única por empresa)
        const existe = await prisma.$queryRawUnsafe(`
            SELECT id FROM marketing_clientes WHERE empresa_id = $1 AND whatsapp = $2
        `, empresaId, whatsapp);

        let clienteResult;
        if (existe.length > 0) {
            clienteResult = await prisma.$queryRawUnsafe(`
                UPDATE marketing_clientes SET nome = $1 WHERE id = $2 RETURNING *
            `, nome, existe[0].id);
        } else {
            clienteResult = await prisma.$queryRawUnsafe(`
                INSERT INTO marketing_clientes (empresa_id, nome, whatsapp) VALUES ($1, $2, $3) RETURNING *
            `, empresaId, nome, whatsapp);
        }

        return res.status(200).json(clienteResult[0]);

    } catch (error) {
        console.error("Erro API Cliente Cadastrar:", error);
        return res.status(500).json({ message: 'Erro ao cadastrar cliente.' });
    }
};

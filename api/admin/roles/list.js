const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token não fornecido' });

        // Identifica Empresa (busca em usuarios e legacy)
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
        if(users.length > 0) empresaId = users[0].empresa_id;
        else {
            const legacy = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
            if(legacy.length > 0) empresaId = legacy[0].id;
        }

        if(!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });

        // Busca Cargos
        const cargos = await prisma.$queryRawUnsafe(`
            SELECT * FROM painel_funcoes 
            WHERE empresa_id = $1 AND ativo = true
            ORDER BY id ASC
        `, empresaId);

        return res.status(200).json(cargos);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro interno.' });
    }
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, id, nome, permissoes } = req.body;
        if (!token || !nome) return res.status(400).json({ message: 'Dados incompletos' });

        // Identifica Empresa
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
        if(users.length > 0) empresaId = users[0].empresa_id;
        else {
            const legacy = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
            if(legacy.length > 0) empresaId = legacy[0].id;
        }

        if(!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });

        const permissoesJson = JSON.stringify(permissoes || []);

        if (id) {
            // Update
            await prisma.$executeRawUnsafe(`
                UPDATE painel_funcoes SET nome = $1, permissoes = $2 
                WHERE id = $3 AND empresa_id = $4
            `, nome, permissoesJson, parseInt(id), empresaId);
        } else {
            // Create
            await prisma.$executeRawUnsafe(`
                INSERT INTO painel_funcoes (empresa_id, nome, permissoes, ativo, criado_em)
                VALUES ($1, $2, $3, true, NOW())
            `, empresaId, nome, permissoesJson);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro interno.' });
    }
};

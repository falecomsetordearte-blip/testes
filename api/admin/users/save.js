const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, id, nome, email, senha, funcao_id } = req.body;
        if (!token || !nome || !email || !funcao_id) return res.status(400).json({ message: 'Dados incompletos' });

        let empresaId = null;
        const auth_users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
        if(auth_users.length > 0) empresaId = auth_users[0].empresa_id;
        else {
            const legacy = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
            if(legacy.length > 0) empresaId = legacy[0].id;
        }

        if(!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });

        if (id) {
            // Update
            if (senha) {
                const hash = await bcrypt.hash(senha, 10);
                await prisma.$executeRawUnsafe(`
                    UPDATE painel_usuarios SET nome = $1, email = $2, funcao_id = $3, senha_hash = $4
                    WHERE id = $5 AND empresa_id = $6
                `, nome, email, parseInt(funcao_id), hash, parseInt(id), empresaId);
            } else {
                await prisma.$executeRawUnsafe(`
                    UPDATE painel_usuarios SET nome = $1, email = $2, funcao_id = $3
                    WHERE id = $4 AND empresa_id = $5
                `, nome, email, parseInt(funcao_id), parseInt(id), empresaId);
            }
        } else {
            // Create
            if (!senha) return res.status(400).json({ message: 'Senha é obrigatória para novo usuário.' });
            
            const hash = await bcrypt.hash(senha, 10);
            await prisma.$executeRawUnsafe(`
                INSERT INTO painel_usuarios (empresa_id, funcao_id, nome, email, senha_hash, ativo, criado_em)
                VALUES ($1, $2, $3, $4, $5, true, NOW())
            `, empresaId, parseInt(funcao_id), nome, email, hash);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error(error);
        if(error.message && error.message.includes('Unique constraint')) {
            return res.status(400).json({ message: 'Este e-mail já está em uso.' });
        }
        return res.status(500).json({ message: 'Erro interno.' });
    }
};

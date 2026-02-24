// /api/designerLogin.js
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { email, senha } = req.body;

        // 1. Busca o designer no banco local
        const designers = await prisma.$queryRawUnsafe(`
            SELECT * FROM designers_financeiro WHERE email = $1 LIMIT 1
        `, email);

        if (designers.length === 0) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        const designer = designers[0];

        // 2. Compara a senha (usando o campo senha_hash que já existe no seu banco)
        const isMatch = await bcrypt.compare(senha, designer.senha_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        // 3. Gera Token de Sessão
        const newToken = randomBytes(32).toString('hex');
        const updatedTokens = designer.session_tokens ? `${designer.session_tokens},${newToken}` : newToken;

        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro SET session_tokens = $1 WHERE designer_id = $2
        `, updatedTokens, designer.designer_id);

        return res.status(200).json({ 
            token: newToken, 
            designer: {
                id: designer.designer_id,
                name: designer.nome || email,
                nivel: designer.nivel
            }
        });

    } catch (error) {
        console.error('Erro login designer:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
// /api/designerLogin.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        const emailLimpo = email.trim().toLowerCase();

        // 1. Busca o designer pelo email no Neon (ignorando maiúsculas)
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome, senha_hash, nivel 
            FROM designers_financeiro 
            WHERE LOWER(email) = $1 LIMIT 1
        `, emailLimpo);

        if (designers.length === 0) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        const designer = designers[0];

        if (!designer.senha_hash) {
            return res.status(401).json({ message: 'Sua senha não foi configurada. Crie uma nova conta com este e-mail.' });
        }

        // 2. Compara a senha
        const isMatch = await bcrypt.compare(senha, designer.senha_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        // 3. Gera Token JWT
        const newToken = jwt.sign(
            { designerId: designer.designer_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const updatedTokens = designer.session_tokens ? `${designer.session_tokens},${newToken}` : newToken;

        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro SET session_tokens = $1 WHERE designer_id = $2
        `, updatedTokens, designer.designer_id);

        return res.status(200).json({ 
            token: newToken, 
            designer: {
                id: designer.designer_id,
                name: designer.nome || emailLimpo.split('@')[0],
                nivel: designer.nivel
            }
        });

    } catch (error) {
        console.error('[LOGIN ERROR] Erro interno no servidor:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
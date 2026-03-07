// /api/designer/register.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ message: 'Preencha todos os campos.' });
        }

        // 1. Verifica se o e-mail já existe
        const check = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE email = $1 LIMIT 1
        `, email);
        
        if (check.length > 0) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado no sistema.' });
        }

        // 2. Criptografa a senha
        const hash = await bcrypt.hash(senha, 10);

        // 3. Insere o novo designer
        await prisma.$executeRawUnsafe(`
            INSERT INTO designers_financeiro 
            (nome, email, senha_hash, nivel, saldo_disponivel, saldo_pendente, pontuacao, aprovados) 
            VALUES ($1, $2, $3, 3, 0, 0, 0, 0)
        `, nome, email, hash);

        // 4. Pega o ID gerado para gerar o token
        const newUser = await prisma.$queryRawUnsafe(`SELECT designer_id FROM designers_financeiro WHERE email = $1`, email);
        const designerId = newUser[0].designer_id;

        // 5. Gera e salva o Token (para logar automaticamente após cadastro)
        const token = jwt.sign({ designerId }, JWT_SECRET, { expiresIn: '7d' });
        await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET session_tokens = $1 WHERE designer_id = $2`, token, designerId);

        return res.status(200).json({ 
            message: 'Conta criada com sucesso!', 
            token: token, 
            nome: nome, 
            nivel: 3 
        });

    } catch (error) {
        console.error('Erro no register.js:', error);
        return res.status(500).json({ message: 'Erro interno ao criar conta.' });
    }
};
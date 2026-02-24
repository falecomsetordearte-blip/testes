// /api/designer/resetPassword.js - VERSÃO NEON 100%
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    try {
        const { token, novaSenha } = req.body;
        if (!token || !novaSenha) return res.status(400).json({ message: 'Dados incompletos.' });

        // 1. Procurar designer pelo token e checar validade
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro 
            WHERE reset_token = $1 AND reset_token_expires > NOW() 
            LIMIT 1
        `, token);

        const designer = designers[0];

        if (!designer) {
            return res.status(400).json({ message: 'O link de recuperação é inválido ou já expirou.' });
        }

        // 2. Criptografar a nova senha
        const novoHash = await bcrypt.hash(novaSenha, 10);

        // 3. Atualizar senha e limpar os campos de reset
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET senha_hash = $1, reset_token = NULL, reset_token_expires = NULL 
            WHERE designer_id = $2
        `, novoHash, designer.designer_id);

        return res.status(200).json({ message: 'Senha alterada com sucesso! Você já pode fazer login.' });

    } catch (error) {
        console.error('Erro resetPassword:', error);
        return res.status(500).json({ message: 'Erro ao redefinir senha.' });
    }
};
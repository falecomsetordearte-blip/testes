// /api/designer/resetPassword.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        const { token, novaSenha } = req.body;
        if (!token || !novaSenha) return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });

        // 1. Encontrar o registro pelo token
        const financeiro = await prisma.designerFinanceiro.findFirst({
            where: {
                reset_token: token,
                reset_token_expires: { gt: new Date() } // Verifica se o token não expirou
            }
        });

        if (!financeiro) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }

        // 2. Criptografar a nova senha
        const senha_hash = await bcrypt.hash(novaSenha, 10);

        // 3. Atualizar a senha e limpar os campos de reset
        await prisma.designerFinanceiro.update({
            where: { designer_id: financeiro.designer_id },
            data: {
                senha_hash: senha_hash,
                reset_token: null,
                reset_token_expires: null
            }
        });

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        console.error('Erro em resetPassword do designer:', error);
        return res.status(500).json({ message: 'Ocorreu um erro interno.' });
    }
};

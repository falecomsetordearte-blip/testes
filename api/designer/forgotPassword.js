// /api/designer/forgotPassword.js - VERSÃO NEON 100%
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');
const { randomBytes } = require('crypto');

module.exports = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'E-mail é obrigatório.' });

        // 1. Buscar o designer no Neon pelo e-mail
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome FROM designers_financeiro WHERE email = $1 LIMIT 1
        `, email);

        const designer = designers[0];

        // Por segurança, mesmo que não ache o e-mail, enviamos a mesma resposta
        if (!designer) {
            return res.status(200).json({ message: 'Se o e-mail estiver cadastrado, você receberá um link em breve.' });
        }

        // 2. Gerar token e expiração (1 hora)
        const resetToken = randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); 

        // 3. Salvar o token no Neon
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET reset_token = $1, reset_token_expires = $2 
            WHERE designer_id = $3
        `, resetToken, expires, designer.designer_id);

        // 4. Enviar o e-mail
        const resetUrl = `${process.env.FRONTEND_URL}/designer/redefinir-senha.html?token=${resetToken}`;
        
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: 587,
            secure: false,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        await transporter.sendMail({
            from: `"Setor de Arte" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Recuperação de Senha - Painel do Designer',
            html: `<h3>Olá ${designer.nome || 'Designer'},</h3>
                   <p>Você solicitou a redefinição de sua senha. Clique no link abaixo para criar uma nova senha:</p>
                   <p><a href="${resetUrl}" style="padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Redefinir Minha Senha</a></p>
                   <p>Se não foi você, ignore este e-mail.</p>`
        });
        
        return res.status(200).json({ message: 'Link de recuperação enviado para o seu e-mail!' });

    } catch (error) {
        console.error('Erro forgotPassword:', error);
        return res.status(500).json({ message: 'Erro interno ao processar solicitação.' });
    }
};
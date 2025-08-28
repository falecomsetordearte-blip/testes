// /api/designer/forgotPassword.js
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

module.exports = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'E-mail é obrigatório.' });

        // 1. Encontrar o designer no Bitrix24 para obter o ID e o nome
        const userSearch = await axios.post(`${BITRIX24_API_URL}user.get.json`, { FILTER: { "EMAIL": email } });
        const designer = userSearch.data.result[0];

        if (!designer) {
            return res.status(200).json({ message: 'Se um e-mail correspondente for encontrado, um link será enviado.' });
        }
        const designerId = parseInt(designer.ID, 10);
        const designerName = designer.NAME;

        // 2. Gerar token e data de expiração
        const resetToken = randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hora

        // 3. Salvar o token no Neon DB usando 'upsert'
        await prisma.designerFinanceiro.upsert({
            where: { designer_id: designerId },
            update: {
                reset_token: resetToken,
                reset_token_expires: resetTokenExpires,
            },
            create: {
                designer_id: designerId,
                reset_token: resetToken,
                reset_token_expires: resetTokenExpires,
            }
        });

        // 4. Enviar o email
        const resetUrl = `${FRONTEND_URL}/designer/redefinir-senha.html?token=${resetToken}`;
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST, port: 587, secure: false,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        await transporter.sendMail({
            from: `"Setor de Arte" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Redefinição de Senha - Painel do Designer',
            html: `<p>Olá ${designerName}, clique no link para redefinir sua senha: <a href="${resetUrl}">Redefinir Senha</a></p>`
        });
        
        return res.status(200).json({ message: 'Se um e-mail correspondente for encontrado, um link será enviado.' });

    } catch (error) {
        console.error('Erro em forgotPassword do designer:', error);
        return res.status(500).json({ message: 'Ocorreu um erro interno.' });
    }
};

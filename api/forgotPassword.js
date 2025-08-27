// /api/forgotPassword.js
const axios = require('axios');
const nodemailer = require('nodemailer');
const { randomBytes } = require('crypto');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'E-mail é obrigatório.' });
        }

        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email, 'EMAIL_VALUE_TYPE': 'WORK' },
            select: ['ID', 'NAME']
        });

        const user = userSearch.data.result[0];
        if (!user) {
            return res.status(200).json({ message: 'Se um e-mail correspondente for encontrado, um link será enviado.' });
        }

        const resetToken = randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000).toISOString(); // Expira em 1 hora

        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: user.ID,
            fields: {
                'UF_CRM_1756285759050': resetToken, // Campo RESET TOKEN atualizado
                'UF_CRM_1756285813385': resetTokenExpires // Campo RESET EXPIRES atualizado
            }
        });

        const resetUrl = `${FRONTEND_URL}/redefinir-senha.html?token=${resetToken}`;
        
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: `"Setor de Arte" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Recuperação de Senha - Setor de Arte',
            html: `
                <p>Olá ${user.NAME},</p>
                <p>Você solicitou a redefinição da sua senha. Clique no link abaixo para criar uma nova senha:</p>
                <a href="${resetUrl}" style="background-color: #38a9f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Redefinir Minha Senha</a>
                <p>Este link expirará em 1 hora.</p>
                <p>Se você não solicitou isso, por favor, ignore este e-mail.</p>
            `,
        });

        return res.status(200).json({ message: 'Se um e-mail correspondente for encontrado, um link será enviado.' });

    } catch (error) {
        console.error('Erro em forgotPassword:', error);
        return res.status(500).json({ message: 'Ocorreu um erro interno.' });
    }
};

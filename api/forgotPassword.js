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
        // O tempo de expiração foi alterado para 48 horas.
        const resetTokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: user.ID,
            fields: {
                'UF_CRM_1756285759050': resetToken,
                'UF_CRM_1756285813385': resetTokenExpires
            }
        });

        const resetUrl = `${FRONTEND_URL}/redefinir-senha.html?token=${resetToken}`;
        
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: `"Setor de Arte" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Redefinição de Senha - Setor de Arte',
            html: `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Redefinição de Senha</title>
                <style>
                    body { margin: 0; padding: 0; font-family: 'Poppins', Arial, sans-serif; background-color: #f4f8fa; }
                    .email-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
                    .email-header { text-align: center; padding: 40px; }
                    .email-header img { height: 90px; }
                    .email-body { padding: 0 40px 40px 40px; text-align: left; color: #2c3e50; font-size: 16px; line-height: 1.6; }
                    .email-body h1 { font-size: 24px; margin-top: 0; margin-bottom: 15px; }
                    .email-body p { margin-bottom: 25px; }
                    .button-wrapper { text-align: center; margin: 30px 0; }
                    .cta-button { background-color: #38a9f4; color: #ffffff !important; padding: 15px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s; }
                    .cta-button:hover { background-color: #2c89c8; }
                    .info-box { background-color: #f4f8fa; padding: 15px; border-radius: 8px; font-size: 14px; color: #555; text-align: center; }
                    .email-footer { background-color: #f4f8fa; padding: 20px 40px; text-align: center; font-size: 12px; color: #8798A8; }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="email-header">
                        <img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte">
                    </div>
                    <div class="email-body">
                        <h1>Vamos redefinir sua senha!</h1>
                        <p>Olá, ${user.NAME}!</p>
                        <p>Recebemos uma solicitação para redefinir a senha da sua conta no Setor de Arte. Para continuar, clique no botão abaixo:</p>
                        <div class="button-wrapper">
                            <a href="${resetUrl}" class="cta-button" target="_blank">Criar Nova Senha</a>
                        </div>
                        <p>Se você não solicitou esta alteração, pode ignorar este e-mail com segurança. Nenhuma alteração será feita na sua conta.</p>
                        <div class="info-box">
                            Este link de redefinição de senha é válido por <strong>48 horas</strong>.
                        </div>
                    </div>
                    <div class="email-footer">
                        <p>© ${new Date().getFullYear()} Setor de Arte. Todos os direitos reservados.</p>
                    </div>
                </div>
            </body>
            </html>
            `
        });

        return res.status(200).json({ message: 'Se um e-mail correspondente for encontrado, um link será enviado.' });

    } catch (error) {
        console.error('Erro em forgotPassword:', error);
        return res.status(500).json({ message: 'Ocorreu um erro interno.' });
    }
};
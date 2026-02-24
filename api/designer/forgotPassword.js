// /api/designer/forgotPassword.js - VERSÃO FINAL GMAIL + NEON

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');
const { randomBytes } = require('crypto');

module.exports = async (req, res) => {
    // Cabeçalhos CORS para permitir chamadas do Front-end
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'E-mail é obrigatório.' });

        // 1. Buscar o designer no Neon pelo e-mail na tabela designers_financeiro
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome FROM designers_financeiro WHERE email = $1 LIMIT 1
        `, email);

        const designer = designers[0];

        // Por segurança, se não existir o e-mail, retornamos sucesso genérico para evitar "pesca" de e-mails
        if (!designer) {
            return res.status(200).json({ message: 'Se o e-mail estiver cadastrado, você receberá um link em breve.' });
        }

        // 2. Gerar token de recuperação (32 bytes) e data de expiração (1 hora a partir de agora)
        const resetToken = randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); 

        // 3. Salvar o token e a expiração no Neon
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET reset_token = $1, reset_token_expires = $2 
            WHERE designer_id = $3
        `, resetToken, expires, designer.designer_id);

        // 4. Configurar o Transportador do Nodemailer usando suas novas variáveis do GMAIL
        const transporter = nodemailer.createTransport({
            service: 'gmail', // O Nodemailer já entende as configs do Gmail por aqui
            host: process.env.GMEMAIL_HOST,
            auth: {
                user: process.env.GMEMAIL_USER, // falecomsetordearte@gmail.com
                pass: process.env.GMEMAIL_PASS  // Sua Senha de App de 16 dígitos
            }
        });

        // 5. Montar o Link de Redefinição
        // Certifique-se que FRONTEND_URL está configurado (ex: https://app.setordearte.com.br)
        const resetUrl = `${process.env.FRONTEND_URL}/designer/redefinir-senha.html?token=${resetToken}`;

        // 6. Configurar o conteúdo do E-mail (HTML)
        const mailOptions = {
            from: `"Setor de Arte" <${process.env.GMEMAIL_USER}>`,
            to: email,
            subject: 'Recuperação de Senha - Painel do Designer',
            html: `
                <div style="font-family: 'Poppins', sans-serif; color: #1e293b; max-width: 550px; border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://app.setordearte.com.br/images/logo-fundo-claro-100x100.png" width="80" alt="Logo">
                    </div>
                    <h2 style="color: #4f46e5; text-align: center;">Olá, ${designer.nome || 'Designer'}!</h2>
                    <p style="font-size: 1rem; line-height: 1.6;">Você solicitou a redefinição de sua senha para acessar o <strong>Painel do Designer</strong>.</p>
                    <p style="font-size: 1rem; line-height: 1.6;">Clique no botão abaixo para escolher uma nova senha. Por segurança, este link é válido por apenas 1 hora.</p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 1rem; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">REDEFINIR MINHA SENHA</a>
                    </div>
                    
                    <p style="font-size: 0.85rem; color: #64748b; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                        Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.
                    </p>
                </div>
            `
        };

        // 7. Disparar o e-mail
        await transporter.sendMail(mailOptions);
        
        return res.status(200).json({ message: 'O link de recuperação foi enviado para o seu e-mail!' });

    } catch (error) {
        console.error('Erro forgotPassword Designer:', error);
        return res.status(500).json({ 
            message: 'Erro interno ao processar a solicitação. Verifique os logs do servidor.',
            error: error.message 
        });
    }
};
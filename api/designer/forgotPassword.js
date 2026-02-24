// /api/designer/forgotPassword.js - VERSÃO COM LOGS DETALHADOS

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');
const { randomBytes } = require('crypto');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    console.log("--- [DEBUG forgotPassword] Início do processo ---");

    try {
        const { email } = req.body;
        console.log(`[DEBUG] Email recebido para recuperação: ${email}`);

        if (!email) {
            console.warn("[DEBUG] Erro: Email não fornecido no corpo da requisição.");
            return res.status(400).json({ message: 'E-mail é obrigatório.' });
        }

        // 1. Busca o designer no Neon
        console.log("[DEBUG] Consultando tabela designers_financeiro no Neon...");
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome FROM designers_financeiro WHERE email = $1 LIMIT 1
        `, email);

        const designer = designers[0];

        if (!designer) {
            console.log(`[DEBUG] Alerta: O email ${email} não foi encontrado no banco de dados.`);
            // Retorno 200 por segurança, mas o log nos avisa o que houve
            return res.status(200).json({ message: 'Se o e-mail estiver cadastrado, você receberá um link em breve.' });
        }

        console.log(`[DEBUG] Designer encontrado: ID ${designer.designer_id} - Nome: ${designer.nome}`);

        // 2. Gerar token e expiração
        const resetToken = randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hora
        console.log(`[DEBUG] Token gerado com sucesso. Expira em: ${expires.toISOString()}`);

        // 3. Salvar o token no Neon
        console.log("[DEBUG] Salvando token no banco de dados...");
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET reset_token = $1, reset_token_expires = $2 
            WHERE designer_id = $3
        `, resetToken, expires, designer.designer_id);
        console.log("[DEBUG] Banco de dados atualizado com o reset_token.");

        // 4. Configurar Nodemailer
        console.log("[DEBUG] Configurando transporte Nodemailer (Gmail)...");
        console.log(`[DEBUG] Variáveis: HOST=${process.env.GMEMAIL_HOST}, USER=${process.env.GMEMAIL_USER}, PASS=${process.env.GMEMAIL_PASS ? 'CONFIGURADA' : 'AUSENTE'}`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMEMAIL_USER,
                pass: process.env.GMEMAIL_PASS
            }
        });

        const resetUrl = `${process.env.FRONTEND_URL}/designer/redefinir-senha.html?token=${resetToken}`;
        console.log(`[DEBUG] URL de reset construída: ${resetUrl}`);

        // 5. Opções do E-mail
        const mailOptions = {
            from: `"Setor de Arte" <${process.env.GMEMAIL_USER}>`,
            to: email,
            subject: 'Recuperação de Senha - Painel do Designer',
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Olá, ${designer.nome}!</h2>
                    <p>Clique no link abaixo para redefinir sua senha:</p>
                    <a href="${resetUrl}">${resetUrl}</a>
                </div>
            `
        };

        // 6. Disparar e-mail
        console.log(`[DEBUG] Tentando enviar e-mail para ${email}...`);
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log("[DEBUG] E-mail enviado com sucesso!");
        console.log(`[DEBUG] ID da mensagem: ${info.messageId}`);
        console.log(`[DEBUG] Resposta do servidor: ${info.response}`);

        return res.status(200).json({ message: 'O link de recuperação foi enviado para o seu e-mail!' });

    } catch (error) {
        console.error("--- [DEBUG ERROR] Erro fatal no forgotPassword ---");
        console.error("Mensagem de erro:", error.message);
        if (error.code) console.error("Código do erro:", error.code);
        if (error.command) console.error("Comando SQL que falhou:", error.command);
        
        // Erros comuns de SMTP (Gmail)
        if (error.message.includes('Invalid login')) {
            console.error("[DEBUG SUGGESTION] O erro 'Invalid Login' indica que a GMEMAIL_PASS está errada ou você não usou uma 'Senha de App'.");
        }

        return res.status(500).json({ 
            message: 'Erro interno ao processar a solicitação.',
            debug: error.message 
        });
    }
};
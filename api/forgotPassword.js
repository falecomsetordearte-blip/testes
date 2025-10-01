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

    // LOG: Início do processo
    console.log('--- [forgotPassword] Início do processo ---');

    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'E-mail é obrigatório.' });
        }
        
        // LOG: E-mail recebido
        console.log(`[forgotPassword] E-mail recebido para redefinição: ${email}`);

        // LOG: Buscando usuário no Bitrix24
        console.log('[forgotPassword] Passo 1: Buscando usuário no Bitrix24...');
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email, 'EMAIL_VALUE_TYPE': 'WORK' },
            select: ['ID', 'NAME']
        });

        const user = userSearch.data.result[0];
        if (!user) {
            // LOG: Usuário não encontrado
            console.log(`[forgotPassword] Usuário com e-mail ${email} não encontrado. Enviando resposta genérica de sucesso por segurança.`);
            return res.status(200).json({ message: 'Se um e-mail correspondente for encontrado, um link será enviado.' });
        }

        // LOG: Usuário encontrado
        console.log(`[forgotPassword] Usuário encontrado: ID=${user.ID}, Nome=${user.NAME}`);

        // LOG: Gerando token
        console.log('[forgotPassword] Passo 2: Gerando token de redefinição...');
        const resetToken = randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        console.log('[forgotPassword] Token gerado com sucesso.');

        // LOG: Atualizando Bitrix24
        console.log('[forgotPassword] Passo 3: Salvando o token no Bitrix24...');
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: user.ID,
            fields: {
                'UF_CRM_1756285759050': resetToken,
                'UF_CRM_1756285813385': resetTokenExpires
            }
        });
        console.log('[forgotPassword] Token salvo com sucesso no Bitrix24.');
        
        // LOG: Configurando Nodemailer
        console.log('[forgotPassword] Passo 4: Configurando o transporte de e-mail (Nodemailer)...');
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: 587,
            secure: false, // true para porta 465, false para outras
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            // Adicionando opções de depuração do Nodemailer
            logger: true,
            debug: true 
        });
        console.log('[forgotPassword] Transporte configurado.');

        // LOG: Enviando e-mail
        console.log(`[forgotPassword] Passo 5: Tentando enviar o e-mail para ${email}...`);
        
        // **MUDANÇA IMPORTANTE**: Capturamos a resposta de sucesso em uma variável 'info'
        const info = await transporter.sendMail({
            from: `"Setor de Arte" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Redefinição de Senha - Setor de Arte',
            html: `... seu HTML aqui ...` // O HTML não precisa mudar
        });

        // LOG: Resposta do servidor de e-mail
        console.log('[forgotPassword] E-mail foi aceito pelo servidor SMTP. Detalhes abaixo:');
        console.log('----------------------------------------------------');
        console.log('ID da Mensagem:', info.messageId);
        console.log('Resposta do Servidor:', info.response);
        console.log('Destinatários Aceitos:', info.accepted);
        console.log('Destinatários Rejeitados:', info.rejected);
        console.log('----------------------------------------------------');

        // LOG: Fim do processo
        console.log('[forgotPassword] Processo concluído com sucesso. Enviando resposta 200 para o frontend.');
        return res.status(200).json({ message: 'Se um e-mail correspondente for encontrado, um link será enviado.' });

    } catch (error) {
        // LOG: Erro no processo
        console.error('[forgotPassword] --- OCORREU UM ERRO NO PROCESSO ---');
        console.error(error);
        return res.status(500).json({ message: 'Ocorreu um erro interno.' });
    }
};
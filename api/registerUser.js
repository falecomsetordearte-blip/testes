const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha } = req.body;

    if (!nomeEmpresa || !cnpj || !telefoneEmpresa || !nomeResponsavel || !email || !senha) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    let companyId = null;
    let contactId = null;

    try {
        // ETAPA 1: VERIFICAR E-MAIL EXISTENTE
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email }, select: ['ID']
        });
        if (searchUserResponse.data.result.length > 0) {
            return res.status(409).json({ message: "Este e-mail já está cadastrado." });
        }

        // ETAPA 2: GERAR DADOS
        const sessionToken = uuidv4();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);
        const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // ETAPA 3: CRIAR COMPANY
        const createCompanyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.add.json`, {
            fields: {
                TITLE: nomeEmpresa,
                PHONE: [{ VALUE: telefoneEmpresa, VALUE_TYPE: 'WORK' }],
                'UF_CRM_CNPJ': cnpj 
            }
        });
        companyId = createCompanyResponse.data.result;
        if (!companyId) throw new Error('Falha ao criar empresa no CRM.');
        
        // ETAPA 4: PREPARAR DADOS DO CONTATO E CRIAR
        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ');

        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: {
                NAME: firstName,
                LAST_NAME: lastName,
                EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                COMPANY_ID: companyId,
                'UF_CRM_1751824202': hashedPassword,
                'UF_CRM_1751824225': sessionToken,
                'UF_CRM_1751829758': '0',
                'UF_CRM_1755112398691': '1',
                'UF_CRM_1755120026423': trialEndDate,
                'UF_CRM_1755120362390': '1',
                'UF_CRM_174535288724': email
            }
        });
        contactId = createContactResponse.data.result;
        if (!contactId) throw new Error('Falha ao criar contato no CRM.');
        
        // ETAPA 5: CRIAR CLIENTE NO ASAAS
        const createAsaasCustomerResponse = await axios.post('https://www.asaas.com/api/v3/customers', 
            { name: nomeEmpresa, cpfCnpj: cnpj }, 
            { headers: { 'access_token': ASAAS_API_KEY } }
        );
        const asaasCustomerId = createAsaasCustomerResponse.data.id;

        // ETAPA 5.1: ATUALIZAR CONTATO NO BITRIX COM O ID DO ASAAS
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId,
            fields: {
                'UF_CRM_1748911653': asaasCustomerId
            }
        });

        // ETAPA 6: GERAR LINK DE PAGAMENTO
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + 30);
        const createPaymentLinkResponse = await axios.post('https://www.asaas.com/api/v3/paymentLinks', {
             name: "Assinatura Mensal - Setor de Arte", description: "Plano mensal com 30 dias de teste gratuito.",
             billingType: "CREDIT_CARD", chargeType: "RECURRENT", subscription: true, value: 89, cycle: "MONTHLY",
             nextDueDate: nextDueDate.toISOString().split('T')[0], customer: asaasCustomerId
        }, { headers: { 'access_token': ASAAS_API_KEY } });
        const checkoutUrl = createPaymentLinkResponse.data.url;

        // ETAPA 7: ENVIAR E-MAIL
        const transporter = nodemailer.createTransport({
            host: EMAIL_HOST,
            port: 587,
            secure: false,
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS,
            },
        });

        const verificationLink = `https://setordearte-painel-git-desenvolvimento-diors-projects-0dc3c14d.vercel.app/verificacao.html?token=${sessionToken}&action=ativar_conta`;

        await transporter.sendMail({
            from: `"Setor de Arte" <${EMAIL_USER}>`,
            to: email,
            subject: "Ative sua conta no Setor de Arte",
            html: `
            <!DOCTYPE html>
            <html lang="pt-br"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ative sua Conta</title><style>body { margin: 0; padding: 0; font-family: 'Poppins', Arial, sans-serif; background-color: #f4f8fa; }.email-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }.email-header { text-align: center; padding: 40px; }.email-header img { height: 90px; }.email-body { padding: 0 40px 40px 40px; text-align: left; color: #2c3e50; font-size: 16px; line-height: 1.6; }.email-body h1 { font-size: 24px; margin-top: 0; margin-bottom: 15px; }.email-body p { margin-bottom: 25px; }.button-wrapper { text-align: center; margin: 30px 0; }.cta-button { background-color: #38a9f4; color: #ffffff !important; padding: 15px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; display: inline-block; }.credentials-box { background-color: #f4f8fa; padding: 20px; margin-top: 20px; border-radius: 8px; font-family: monospace; color: #2c3e50; font-size: 15px; }.email-footer { background-color: #f4f8fa; padding: 20px 40px; text-align: center; font-size: 12px; color: #8798A8; }</style></head>
            <body><div class="email-container"><div class="email-header"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte"></div><div class="email-body"><h1>Falta só um passo!</h1><p>Olá! Para garantir a segurança da sua conta no Setor de Arte, precisamos que você verifique seu endereço de e-mail.</p><p>Clique no botão abaixo para ativar sua conta e acessar o painel:</p><div class="button-wrapper"><a href="${verificationLink}" class="cta-button" target="_blank">Ativar Minha Conta</a></div><p>Se você não criou esta conta, por favor, ignore este e-mail.</p><p>Atenciosamente,<br>Equipe Setor de Arte</p></div><div class="email-footer"><p>© ${new Date().getFullYear()} Setor de Arte. Todos os direitos reservados.</p></div></div></body></html>
            `
        });
        
        // ETAPA FINAL: SUCESSO
        return res.status(200).json({ checkoutUrl: checkoutUrl });

    } catch (error) {
        console.error('Erro no processo de cadastro:', error.response ? error.response.data : error.message);
        
        if (contactId) { await axios.post(`${BITRIX24_API_URL}crm.contact.delete.json`, { id: contactId }); }
        if (companyId) { await axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }); }
        
        return res.status(500).json({ message: 'Ocorreu um erro ao processar seu cadastro. Por favor, tente novamente.' });
    }
};

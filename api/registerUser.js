// /api/registerUser.js - ETAPA 1
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
    console.log("[DEBUG] API /api/registerUser iniciada.");
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha } = req.body;
    if (!nomeEmpresa || !email || !senha) return res.status(400).json({ message: 'Campos obrigatórios faltando.' });

    let companyId = null;
    let contactId = null;

    try {
        console.log("[DEBUG] 1. Verificando se o e-mail já existe...");
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email }, select: ['ID']
        });
        if (searchUserResponse.data.result.length > 0) {
            console.log("[INFO] E-mail já cadastrado.");
            return res.status(409).json({ message: "Este e-mail já está cadastrado." });
        }
        console.log("[DEBUG] E-mail disponível.");

        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);
        console.log("[DEBUG] 2. Dados de senha e token gerados.");

        console.log("[DEBUG] 3. Criando Company no Bitrix24...");
        const createCompanyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.add.json`, {
            fields: { TITLE: nomeEmpresa, PHONE: [{ VALUE: telefoneEmpresa, VALUE_TYPE: 'WORK' }], 'UF_CRM_CNPJ': cnpj }
        });
        companyId = createCompanyResponse.data.result;
        if (!companyId) throw new Error('Falha ao criar empresa no CRM.');
        console.log(`[DEBUG] Company criada com ID: ${companyId}`);

        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ');

        console.log("[DEBUG] 4. Criando Contato no Bitrix24...");
        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: { NAME: firstName, LAST_NAME: lastName, EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }], COMPANY_ID: companyId, 'UF_CRM_1751824202': hashedPassword, 'UF_CRM_1751824225': sessionToken }
        });
        contactId = createContactResponse.data.result;
        if (!contactId) throw new Error('Falha ao criar contato no CRM.');
        console.log(`[DEBUG] Contato criado com ID: ${contactId}`);
        
        console.log("[DEBUG] 5. Criando Cliente no Asaas...");
        const createAsaasCustomerResponse = await axios.post('https://www.asaas.com/api/v3/customers', 
            { name: nomeEmpresa, cpfCnpj: cnpj }, 
            { headers: { 'access_token': ASAAS_API_KEY } }
        );
        const asaasCustomerId = createAsaasCustomerResponse.data.id;
        console.log(`[DEBUG] Cliente Asaas criado com ID: ${asaasCustomerId}`);

        console.log("[DEBUG] 5.1. Atualizando Contato no Bitrix24 com Asaas ID...");
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId, fields: { 'UF_CRM_1748911653': asaasCustomerId }
        });

        // Bloco de envio de e-mail (mantido)
        console.log("[DEBUG] 7. Enviando e-mail de verificação...");
        // ... (código do nodemailer permanece o mesmo) ...
        
        console.log("[DEBUG] Cadastro bem-sucedido. Retornando dados para a próxima etapa.");
        return res.status(200).json({
            success: true,
            contactId: contactId,
            companyId: companyId,
            asaasCustomerId: asaasCustomerId
        });

    } catch (error) {
        console.error('Erro no processo de cadastro:', error.response ? error.response.data : error.message);
        if (contactId) { await axios.post(`${BITRIX24_API_URL}crm.contact.delete.json`, { id: contactId }); }
        if (companyId) { await axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }); }
        return res.status(500).json({ message: 'Ocorreu um erro ao processar seu cadastro.' });
    }
};

// /api/registerUser.js
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Variáveis de Ambiente
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

module.exports = async (req, res) => {
    console.log("[DEBUG] API /api/registerUser iniciada.");

    // Configuração de CORS (Essencial para Vercel)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Tratamento da requisição OPTIONS (Pre-flight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Apenas método POST é permitido
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    // Recebimento dos dados do Body
    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha } = req.body;

    // Validação dos campos obrigatórios
    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    let companyId = null;
    let contactId = null;

    try {
        // =================================================================================
        // 1. Verificar se o e-mail já existe no Bitrix24
        // =================================================================================
        console.log("[DEBUG] 1. Verificando disponibilidade do e-mail...");
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email },
            select: ['ID']
        });

        if (searchUserResponse.data.result && searchUserResponse.data.result.length > 0) {
            console.log("[INFO] E-mail já cadastrado.");
            return res.status(409).json({ message: "Este e-mail já está cadastrado em nossa base." });
        }

        // =================================================================================
        // 2. Preparar Segurança (Hash da Senha e Token de Sessão)
        // =================================================================================
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);
        console.log("[DEBUG] 2. Hash de senha e token gerados.");

        // =================================================================================
        // 3. Criar Empresa (Company) no Bitrix24
        // =================================================================================
        console.log("[DEBUG] 3. Criando Empresa no Bitrix24...");
        const createCompanyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.add.json`, {
            fields: {
                TITLE: nomeEmpresa,
                PHONE: [{ VALUE: telefoneEmpresa, VALUE_TYPE: 'WORK' }],
                'UF_CRM_CNPJ': cnpj // Verifique se este campo personalizado existe no seu Bitrix
            }
        });
        
        companyId = createCompanyResponse.data.result;
        if (!companyId) throw new Error('Falha ao criar a empresa no CRM.');
        console.log(`[DEBUG] Empresa criada com ID: ${companyId}`);

        // =================================================================================
        // 4. Criar Contato (Responsável) no Bitrix24
        // =================================================================================
        console.log("[DEBUG] 4. Criando Contato no Bitrix24...");
        
        // Separar Nome e Sobrenome
        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ') || '';

        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: {
                NAME: firstName,
                LAST_NAME: lastName,
                EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                COMPANY_ID: companyId,
                'UF_CRM_1751824202': hashedPassword, // Campo personalizado para Senha
                'UF_CRM_1751824225': sessionToken    // Campo personalizado para Token
            }
        });

        contactId = createContactResponse.data.result;
        if (!contactId) throw new Error('Falha ao criar o contato no CRM.');
        console.log(`[DEBUG] Contato criado com ID: ${contactId}`);

        // =================================================================================
        // 5. Criar Cliente no ASAAS
        // =================================================================================
        console.log("[DEBUG] 5. Criando Cliente na API do Asaas...");
        
        const createAsaasCustomerResponse = await axios.post(
            'https://www.asaas.com/api/v3/customers',
            {
                name: nomeEmpresa,
                cpfCnpj: cnpj,
                email: email,
                mobilePhone: telefoneEmpresa,
                externalReference: contactId // Vinculo útil para saber quem é quem
            },
            {
                headers: { 
                    'access_token': ASAAS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const asaasCustomerId = createAsaasCustomerResponse.data.id;
        console.log(`[DEBUG] Cliente Asaas criado com ID: ${asaasCustomerId}`);

        // =================================================================================
        // 6. Atualizar Contato no Bitrix com o ID do Asaas
        // =================================================================================
        console.log("[DEBUG] 6. Vinculando ID Asaas ao Bitrix...");
        
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId,
            fields: {
                'UF_CRM_1748911653': asaasCustomerId // Campo personalizado para ID Asaas
            }
        });

        // =================================================================================
        // 7. (Opcional) Envio de E-mail de Boas-Vindas
        // =================================================================================
        // Se quiser ativar o envio de e-mail, descomente o bloco abaixo
        /*
        try {
            const transporter = nodemailer.createTransport({
                host: EMAIL_HOST,
                port: 587,
                secure: false,
                auth: { user: EMAIL_USER, pass: EMAIL_PASS }
            });
            await transporter.sendMail({
                from: `"Setor de Arte" <${EMAIL_USER}>`,
                to: email,
                subject: "Bem-vindo ao Setor de Arte!",
                html: `<p>Olá <strong>${firstName}</strong>,</p><p>Seu cadastro foi realizado com sucesso.</p>`
            });
        } catch (emailError) {
            console.error("Erro ao enviar e-mail (não crítico):", emailError.message);
        }
        */

        // =================================================================================
        // 8. Retorno de Sucesso (Login Automático)
        // =================================================================================
        console.log("[DEBUG] Cadastro finalizado com sucesso.");

        return res.status(200).json({
            success: true,
            message: "Cadastro realizado com sucesso!",
            token: sessionToken,     // Token para o front salvar no localStorage
            userName: firstName,     // Nome para exibir no dashboard
            contactId: contactId,
            companyId: companyId,
            asaasCustomerId: asaasCustomerId
        });

    } catch (error) {
        console.error('Erro CRÍTICO no processo de cadastro:', error.response ? error.response.data : error.message);

        // =================================================================================
        // Rollback: Limpeza de dados em caso de erro
        // =================================================================================
        // Se criou empresa mas deu erro depois (ex: no Asaas), apaga para não duplicar
        if (companyId && !contactId) {
            console.log("Executando Rollback: Deletando empresa órfã...");
            await axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e => console.error('Falha no rollback empresa:', e.message));
        }
        // Se criou contato mas deu erro no Asaas, apaga o contato e a empresa
        if (contactId) {
             console.log("Executando Rollback: Deletando contato e empresa...");
             await axios.post(`${BITRIX24_API_URL}crm.contact.delete.json`, { id: contactId }).catch(e => console.error('Falha no rollback contato:', e.message));
             if(companyId) await axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e => console.error('Falha no rollback empresa:', e.message));
        }

        return res.status(500).json({ 
            message: 'Ocorreu um erro ao processar seu cadastro. Por favor, tente novamente.' 
        });
    }
};
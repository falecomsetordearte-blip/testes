// /api/registerUser.js
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { Client } = require('pg'); // <--- IMPORTANTE: Importar cliente do Postgres

// Variáveis de Ambiente
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
// const EMAIL_HOST = process.env.EMAIL_HOST;
// const EMAIL_USER = process.env.EMAIL_USER;
// const EMAIL_PASS = process.env.EMAIL_PASS;
const DATABASE_URL = process.env.DATABASE_URL; // <--- Sua string de conexão Neon

module.exports = async (req, res) => {
    console.log("[DEBUG] API /api/registerUser iniciada.");

    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha } = req.body;

    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    let companyId = null;
    let contactId = null;
    let asaasCustomerId = null;

    try {
        // 1. Verificar e-mail no Bitrix
        console.log("[DEBUG] 1. Verificando disponibilidade do e-mail...");
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email },
            select: ['ID']
        });

        if (searchUserResponse.data.result && searchUserResponse.data.result.length > 0) {
            return res.status(409).json({ message: "Este e-mail já está cadastrado em nossa base." });
        }

        // 2. Hash Senha e Token
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);
        
        // 3. Criar Empresa no Bitrix
        console.log("[DEBUG] 3. Criando Empresa no Bitrix24...");
        const createCompanyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.add.json`, {
            fields: {
                TITLE: nomeEmpresa,
                PHONE: [{ VALUE: telefoneEmpresa, VALUE_TYPE: 'WORK' }],
                'UF_CRM_CNPJ': cnpj 
            }
        });
        companyId = createCompanyResponse.data.result;
        if (!companyId) throw new Error('Falha ao criar a empresa no CRM.');

        // 4. Criar Contato no Bitrix
        console.log("[DEBUG] 4. Criando Contato no Bitrix24...");
        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ') || '';

        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: {
                NAME: firstName,
                LAST_NAME: lastName,
                EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                COMPANY_ID: companyId,
                'UF_CRM_1751824202': hashedPassword,
                'UF_CRM_1751824225': sessionToken
            }
        });
        contactId = createContactResponse.data.result;
        if (!contactId) throw new Error('Falha ao criar o contato no CRM.');

        // 5. Criar Cliente no ASAAS
        console.log("[DEBUG] 5. Criando Cliente na API do Asaas...");
        const createAsaasCustomerResponse = await axios.post(
            'https://www.asaas.com/api/v3/customers',
            {
                name: nomeEmpresa,
                cpfCnpj: cnpj,
                email: email,
                mobilePhone: telefoneEmpresa,
                externalReference: contactId
            },
            { headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' } }
        );
        asaasCustomerId = createAsaasCustomerResponse.data.id;

        // 6. Atualizar Bitrix com ID Asaas
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId,
            fields: { 'UF_CRM_1748911653': asaasCustomerId }
        });

        // =================================================================================
        // 9. NOVO: SALVAR NO BANCO DE DADOS NEON
        // =================================================================================
        console.log("[DEBUG] 9. Salvando registro no Banco de Dados Neon...");
        
        const client = new Client({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false } // Necessário para conexão segura com Neon
        });

        try {
            await client.connect();

            // AVISO: Verifique se os nomes das colunas abaixo batem com sua tabela no Neon.
            // Estou assumindo uma tabela 'empresas'. O 'logo_id' enviamos NULL por enquanto.
            
            const sql = `
                INSERT INTO empresas (
                    cnpj, 
                    nome_fantasia, 
                    whatsapp, 
                    email, 
                    responsavel, 
                    bitrix_id, 
                    asaas_id, 
                    logo_id,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING id;
            `;

            const values = [
                cnpj,
                nomeEmpresa,        // nome_fantasia
                telefoneEmpresa,    // whatsapp
                email,
                nomeResponsavel,
                contactId,          // bitrix_id (salvando ID do contato ou companyId dependendo da sua lógica)
                asaasCustomerId,
                null                // logo_id (deixamos null pois vem do cadastro.html)
            ];

            await client.query(sql, values);
            console.log("[DEBUG] Registro salvo no Neon com sucesso.");

        } catch (dbError) {
            // Não vamos quebrar o cadastro se der erro no banco SQL, mas vamos logar o erro.
            console.error("ERRO AO SALVAR NO NEON:", dbError);
            // Se for crítico, você pode dar throw(dbError) aqui para acionar o rollback geral.
        } finally {
            await client.end();
        }
        // =================================================================================

        // Retorno de Sucesso
        return res.status(200).json({
            success: true,
            message: "Cadastro realizado com sucesso!",
            token: sessionToken,
            userName: firstName,
            contactId: contactId,
            companyId: companyId,
            asaasCustomerId: asaasCustomerId
        });

    } catch (error) {
        console.error('Erro CRÍTICO no processo de cadastro:', error.response ? error.response.data : error.message);

        // Rollback (simplificado)
        if (companyId && !contactId) {
            await axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e => console.error('Rollback fail', e));
        }
        if (contactId) {
             await axios.post(`${BITRIX24_API_URL}crm.contact.delete.json`, { id: contactId }).catch(e => console.error('Rollback fail', e));
             if(companyId) await axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e => console.error('Rollback fail', e));
        }

        return res.status(500).json({ 
            message: 'Ocorreu um erro ao processar seu cadastro. Por favor, tente novamente.' 
        });
    }
};
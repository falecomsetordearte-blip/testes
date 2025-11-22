// /api/registerUser.js
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

// Variáveis de Ambiente
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// *** CONFIGURAÇÃO DO DRIVE BITRIX ***
// ID da pasta "Logos de Clientes" que você criou
const BITRIX_LOGOS_FOLDER_ID = 251803; 

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

    // 1. Extrair dados (incluindo o logo)
    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha, logo } = req.body;

    // Validação
    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    let companyId = null;
    let contactId = null;
    let asaasCustomerId = null;
    let bitrixLogoId = null; // Aqui guardaremos o ID do arquivo

    try {
        // =================================================================
        // 1. Verificar duplicidade de email no Bitrix
        // =================================================================
        console.log("[DEBUG] 1. Verificando e-mail...");
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email },
            select: ['ID']
        });

        if (searchUserResponse.data.result && searchUserResponse.data.result.length > 0) {
            return res.status(409).json({ message: "Este e-mail já está cadastrado em nossa base." });
        }

        // =================================================================
        // 2. UPLOAD DO LOGO PARA O BITRIX (Se houver)
        // =================================================================
        if (logo && logo.base64) {
            console.log("[DEBUG] 2. Processando upload de logo para pasta:", BITRIX_LOGOS_FOLDER_ID);
            try {
                // Remove o cabeçalho "data:image/png;base64," para enviar só os bytes
                const base64Content = logo.base64.split(';base64,').pop();
                // Limpa nome do arquivo para evitar caracteres estranhos
                const safeName = `${cnpj.replace(/\D/g,'')}_${logo.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;

                const uploadResponse = await axios.post(`${BITRIX24_API_URL}disk.folder.uploadfile.json`, {
                    id: BITRIX_LOGOS_FOLDER_ID,
                    data: {
                        NAME: safeName,
                        CONTENT: base64Content
                    },
                    generateUniqueName: true
                });

                if (uploadResponse.data.result && uploadResponse.data.result.ID) {
                    bitrixLogoId = uploadResponse.data.result.ID;
                    console.log(`[DEBUG] Logo enviado com sucesso! ID Bitrix: ${bitrixLogoId}`);
                } else {
                    console.warn("[WARN] Bitrix não retornou ID do arquivo no upload.");
                }
            } catch (uploadError) {
                console.error("[ERRO] Falha no upload do logo:", uploadError.message);
                // Não interrompemos o cadastro, apenas seguimos sem logo
            }
        }

        // =================================================================
        // 3. Preparar Dados de Acesso
        // =================================================================
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);

        // =================================================================
        // 4. Criar Empresa no Bitrix
        // =================================================================
        console.log("[DEBUG] 4. Criando Empresa...");
        const createCompanyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.add.json`, {
            fields: {
                TITLE: nomeEmpresa,
                PHONE: [{ VALUE: telefoneEmpresa, VALUE_TYPE: 'WORK' }],
                'UF_CRM_CNPJ': cnpj
            }
        });
        companyId = createCompanyResponse.data.result;
        if (!companyId) throw new Error('Falha ao criar empresa no CRM.');

        // =================================================================
        // 5. Criar Contato no Bitrix
        // =================================================================
        console.log("[DEBUG] 5. Criando Contato...");
        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ') || '';

        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: {
                NAME: firstName,
                LAST_NAME: lastName,
                EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                COMPANY_ID: companyId,
                'UF_CRM_1751824202': hashedPassword, // Campo Senha
                'UF_CRM_1751824225': sessionToken    // Campo Token
            }
        });
        contactId = createContactResponse.data.result;
        if (!contactId) throw new Error('Falha ao criar contato no CRM.');

        // =================================================================
        // 6. Criar Cliente no Asaas
        // =================================================================
        console.log("[DEBUG] 6. Criando Cliente Asaas...");
        const createAsaasResponse = await axios.post('https://www.asaas.com/api/v3/customers', 
            {
                name: nomeEmpresa,
                cpfCnpj: cnpj,
                email: email,
                mobilePhone: telefoneEmpresa,
                externalReference: contactId
            },
            { headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' } }
        );
        asaasCustomerId = createAsaasResponse.data.id;

        // =================================================================
        // 7. Vincular Asaas ao Bitrix
        // =================================================================
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId,
            fields: { 'UF_CRM_1748911653': asaasCustomerId }
        });

        // =================================================================
        // 8. SALVAR NO BANCO DE DADOS NEON (POSTGRES)
        // =================================================================
        console.log("[DEBUG] 8. Salvando no Neon...");
        const client = new Client({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();

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
                nomeEmpresa,
                telefoneEmpresa,
                email,
                nomeResponsavel,
                contactId,
                asaasCustomerId,
                bitrixLogoId // <--- AQUI VAI O ID DO LOGO (ou null se falhou/não enviou)
            ];

            const dbRes = await client.query(sql, values);
            console.log(`[DEBUG] SUCESSO FINAL! Salvo no Neon (ID: ${dbRes.rows[0].id}). LogoID: ${bitrixLogoId}`);

        } catch (dbError) {
            console.error("ERRO AO SALVAR NO NEON:", dbError.message);
            // Não damos throw aqui para não cancelar o sucesso do usuário no front
        } finally {
            await client.end();
        }

        // =================================================================
        // 9. Retorno Final
        // =================================================================
        return res.status(200).json({
            success: true,
            message: "Cadastro realizado com sucesso!",
            token: sessionToken,
            userName: firstName,
            contactId: contactId
        });

    } catch (error) {
        console.error('Erro CRÍTICO:', error.message);
        // Rollback Básico
        if (companyId && !contactId) axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e=>{});
        return res.status(500).json({ message: 'Erro ao processar cadastro. Tente novamente.' });
    }
};
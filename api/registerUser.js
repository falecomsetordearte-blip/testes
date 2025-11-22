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

    // 1. Extrair dados
    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha, logo } = req.body;

    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    let companyId = null;
    let contactId = null;
    let asaasCustomerId = null;
    let bitrixLogoId = null;

    try {
        // =================================================================
        // 1. Verificar e-mail no Bitrix
        // =================================================================
        console.log("[DEBUG] 1. Verificando disponibilidade do e-mail...");
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email },
            select: ['ID']
        });

        if (searchUserResponse.data.result && searchUserResponse.data.result.length > 0) {
            return res.status(409).json({ message: "Este e-mail já está cadastrado em nossa base." });
        }

        // =================================================================
        // 2. UPLOAD DO LOGO (COM DEPURAÇÃO DETALHADA)
        // =================================================================
        if (logo && logo.base64) {
            console.log(`[DEBUG] 2. Iniciando upload para pasta ID: ${BITRIX_LOGOS_FOLDER_ID}`);
            
            try {
                // Limpeza do Base64 e do Nome do arquivo
                const base64Content = logo.base64.split(';base64,').pop();
                const cleanName = logo.name.replace(/[^a-zA-Z0-9._-]/g, '');
                const finalFileName = `${cnpj.replace(/\D/g,'')}_${cleanName}`;

                console.log(`[DEBUG] Enviando arquivo: ${finalFileName}`);

                const uploadResponse = await axios.post(`${BITRIX24_API_URL}disk.folder.uploadfile.json`, {
                    id: BITRIX_LOGOS_FOLDER_ID,
                    data: {
                        NAME: finalFileName,
                        CONTENT: base64Content
                    },
                    generateUniqueName: true
                });

                // *** LOG DA RESPOSTA BRUTA DO BITRIX ***
                console.log("[DEBUG] >>> RESPOSTA DO BITRIX (UPLOAD):", JSON.stringify(uploadResponse.data));

                if (uploadResponse.data.result && uploadResponse.data.result.ID) {
                    bitrixLogoId = uploadResponse.data.result.ID;
                    console.log(`[DEBUG] SUCESSO! ID do Arquivo gerado: ${bitrixLogoId}`);
                } else {
                    console.warn("[WARN] Upload feito, mas o Bitrix não retornou o campo 'ID' dentro de 'result'.");
                }

            } catch (uploadError) {
                console.error("[ERRO CRÍTICO NO UPLOAD]");
                if (uploadError.response) {
                    // O servidor respondeu com um status de erro (4xx, 5xx)
                    console.error("Status:", uploadError.response.status);
                    console.error("Detalhes do Erro:", JSON.stringify(uploadError.response.data));
                } else {
                    console.error("Erro de conexão:", uploadError.message);
                }
                // Não damos throw, permitimos o cadastro seguir sem logo
            }
        } else {
            console.log("[DEBUG] 2. Nenhum logo enviado pelo usuário. Pulando upload.");
        }

        // =================================================================
        // 3. Segurança e Token
        // =================================================================
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);

        // =================================================================
        // 4. Criar Empresa
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
        // 5. Criar Contato
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
                'UF_CRM_1751824202': hashedPassword,
                'UF_CRM_1751824225': sessionToken
            }
        });
        contactId = createContactResponse.data.result;
        if (!contactId) throw new Error('Falha ao criar contato no CRM.');

        // =================================================================
        // 6. Criar Asaas
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
        // 7. Atualizar Bitrix com Asaas ID
        // =================================================================
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId,
            fields: { 'UF_CRM_1748911653': asaasCustomerId }
        });

        // =================================================================
        // 8. Salvar no Neon
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
                    cnpj, nome_fantasia, whatsapp, email, responsavel, 
                    bitrix_id, asaas_id, logo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING id;
            `;

            const values = [
                cnpj, nomeEmpresa, telefoneEmpresa, email, nomeResponsavel,
                contactId, asaasCustomerId, bitrixLogoId
            ];

            const dbRes = await client.query(sql, values);
            console.log(`[DEBUG] SUCESSO FINAL! Salvo no Neon (ID Tabela: ${dbRes.rows[0].id}). LogoID Salvo: ${bitrixLogoId}`);

        } catch (dbError) {
            console.error("ERRO AO SALVAR NO NEON:", dbError.message);
        } finally {
            await client.end();
        }

        // =================================================================
        // 9. Retorno
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
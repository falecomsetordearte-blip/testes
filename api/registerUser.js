// /api/registerUser.js
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

// Variáveis de Ambiente
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const BITRIX_LOGOS_FOLDER_ID = 251803; 

// --- FUNÇÃO AUXILIAR: Upload Robusto em 2 Etapas ---
async function uploadToBitrixDisk(folderId, filename, base64Content) {
    try {
        // 1. Obter URL
        const getUrlResponse = await axios.get(`${BITRIX24_API_URL}disk.folder.uploadfile.json`, {
            params: { id: folderId }
        });
        if (!getUrlResponse.data.result || !getUrlResponse.data.result.uploadUrl) {
            throw new Error("Bitrix não forneceu URL de upload.");
        }
        const uploadUrl = getUrlResponse.data.result.uploadUrl;

        // 2. Preparar Payload
        const fileBuffer = Buffer.from(base64Content, 'base64');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
        const header = `--${boundary}\r\n` +
                       `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
                       `Content-Type: application/octet-stream\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;
        const payload = Buffer.concat([Buffer.from(header, 'utf-8'), fileBuffer, Buffer.from(footer, 'utf-8')]);

        // 3. Enviar
        const uploadResponse = await axios.post(uploadUrl, payload, {
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': payload.length }
        });

        // 4. Retornar ID
        if (uploadResponse.data.result && uploadResponse.data.result.ID) return uploadResponse.data.result.ID;
        return null;
    } catch (error) {
        console.error("[UPLOAD HELPER ERROR]", error.message);
        return null;
    }
}

module.exports = async (req, res) => {
    console.log("[DEBUG] API /api/registerUser iniciada.");

    // Configuração CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha, logo } = req.body;

    // Validação básica de campos
    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    // =================================================================
    // 0. VERIFICAÇÃO DE DUPLICIDADE NO BANCO DE DADOS (NEON)
    // =================================================================
    console.log("[DEBUG] 0. Verificando duplicidade no Banco de Dados...");
    const checkClient = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await checkClient.connect();
        
        // Verificamos se JÁ EXISTE algum registro com este Email, CNPJ ou WhatsApp
        const checkSql = `
            SELECT email, cnpj, whatsapp 
            FROM empresas 
            WHERE email = $1 OR cnpj = $2 OR whatsapp = $3
            LIMIT 1;
        `;
        
        const checkResult = await checkClient.query(checkSql, [email, cnpj, telefoneEmpresa]);

        if (checkResult.rows.length > 0) {
            const existing = checkResult.rows[0];
            
            // Identifica qual campo causou a duplicidade para dar a mensagem correta
            if (existing.email === email) {
                return res.status(409).json({ message: "Este e-mail já possui cadastro no sistema." });
            }
            if (existing.cnpj === cnpj) {
                return res.status(409).json({ message: "Este CNPJ já está cadastrado." });
            }
            if (existing.whatsapp === telefoneEmpresa) {
                return res.status(409).json({ message: "Este número de WhatsApp já está em uso." });
            }
            return res.status(409).json({ message: "Dados já cadastrados no sistema." });
        }
        
    } catch (dbError) {
        console.error("[ERRO CRÍTICO DB]", dbError.message);
        return res.status(500).json({ message: "Erro ao verificar disponibilidade dos dados. Tente novamente." });
    } finally {
        await checkClient.end(); // Fecha conexão de verificação para não travar
    }
    // =================================================================

    let companyId = null;
    let contactId = null;
    let asaasCustomerId = null;
    let bitrixLogoId = null;

    try {
        // 1. Verificar Email no Bitrix (Dupla checagem, caso o DB esteja dessincronizado)
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email }, select: ['ID']
        });
        if (searchUserResponse.data.result && searchUserResponse.data.result.length > 0) {
            return res.status(409).json({ message: "Este e-mail já existe no CRM." });
        }

        // 2. Upload Logo
        if (logo && logo.base64) {
            console.log(`[DEBUG] 2. Upload de logo...`);
            const base64Clean = logo.base64.split(';base64,').pop();
            const cleanName = logo.name.replace(/[^a-zA-Z0-9._-]/g, '');
            const finalName = `${cnpj.replace(/\D/g,'')}_${cleanName}`;

            bitrixLogoId = await uploadToBitrixDisk(BITRIX_LOGOS_FOLDER_ID, finalName, base64Clean);
            console.log(`[DEBUG] Logo ID: ${bitrixLogoId || 'Falha'}`);
        }

        // 3. Dados de Acesso
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);
        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ') || '';

        // 4. Criar Empresa Bitrix
        console.log("[DEBUG] 4. Criando Empresa...");
        const createCompanyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.add.json`, {
            fields: { TITLE: nomeEmpresa, PHONE: [{ VALUE: telefoneEmpresa, VALUE_TYPE: 'WORK' }], 'UF_CRM_CNPJ': cnpj }
        });
        companyId = createCompanyResponse.data.result;
        if(!companyId) throw new Error("Falha ao criar empresa no CRM");

        // 5. Criar Contato Bitrix
        console.log("[DEBUG] 5. Criando Contato...");
        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: {
                NAME: firstName, LAST_NAME: lastName, EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                COMPANY_ID: companyId, 'UF_CRM_1751824202': hashedPassword, 'UF_CRM_1751824225': sessionToken
            }
        });
        contactId = createContactResponse.data.result;
        if(!contactId) throw new Error("Falha ao criar contato no CRM");

        // 6. Criar Asaas
        console.log("[DEBUG] 6. Criando Asaas...");
        const createAsaasResponse = await axios.post('https://www.asaas.com/api/v3/customers', {
            name: nomeEmpresa, cpfCnpj: cnpj, email: email, mobilePhone: telefoneEmpresa, externalReference: contactId
        }, { headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' } });
        asaasCustomerId = createAsaasResponse.data.id;

        // 7. Update Bitrix
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId, fields: { 'UF_CRM_1748911653': asaasCustomerId }
        });

        // 8. Salvar no Neon
        console.log("[DEBUG] 8. Salvando no Banco...");
        const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            const sql = `
                INSERT INTO empresas (
                    cnpj, nome_fantasia, whatsapp, email, responsavel, 
                    bitrix_id, asaas_id, logo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING id;
            `;
            const values = [cnpj, nomeEmpresa, telefoneEmpresa, email, nomeResponsavel, contactId, asaasCustomerId, bitrixLogoId];
            const dbRes = await client.query(sql, values);
            console.log(`[DEBUG] Sucesso! DB ID: ${dbRes.rows[0].id}`);
        } catch (dbError) {
            console.error("ERRO NEON SAVE:", dbError.message);
            // Se der erro aqui, é grave, mas os serviços externos já foram criados. 
            // Idealmente faríamos rollback, mas para MVP seguimos.
        } finally {
            await client.end();
        }

        return res.status(200).json({
            success: true,
            message: "Cadastro realizado com sucesso!",
            token: sessionToken,
            userName: firstName,
            contactId: contactId
        });

    } catch (error) {
        console.error('Erro CRÍTICO:', error.message);
        // Rollback básico (apagar empresa se falhar contato)
        if (companyId && !contactId) axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e=>{});
        return res.status(500).json({ message: 'Erro ao processar cadastro. Tente novamente.' });
    }
};
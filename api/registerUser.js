// /api/registerUser.js - ATUALIZADO (Salva bitrix_company_id)
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

// Variáveis de Ambiente
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const BITRIX_LOGOS_FOLDER_ID = 251803; 

// --- FUNÇÃO AUXILIAR: Upload de Logo ---
async function uploadToBitrixDisk(folderId, filename, base64Content) {
    try {
        const getUrlResponse = await axios.get(`${BITRIX24_API_URL}disk.folder.uploadfile.json`, {
            params: { id: folderId }
        });
        if (!getUrlResponse.data.result || !getUrlResponse.data.result.uploadUrl) return null;
        
        const uploadUrl = getUrlResponse.data.result.uploadUrl;
        const fileBuffer = Buffer.from(base64Content, 'base64');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
        
        const payload = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf-8'),
            fileBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
        ]);

        const uploadResponse = await axios.post(uploadUrl, payload, {
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': payload.length }
        });

        if (uploadResponse.data.result && uploadResponse.data.result.ID) return uploadResponse.data.result.ID;
        return null;
    } catch (error) {
        console.error("[UPLOAD ERROR]", error.message);
        return null;
    }
}

module.exports = async (req, res) => {
    console.log("[DEBUG] API /api/registerUser iniciada.");

    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha, logo } = req.body;

    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }

    // =================================================================
    // 0. VALIDAÇÃO DE DUPLICIDADE (NEON)
    // =================================================================
    const checkClient = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await checkClient.connect();
        const checkResult = await checkClient.query(
            `SELECT email, cnpj, whatsapp FROM empresas WHERE email = $1 OR cnpj = $2 OR whatsapp = $3 LIMIT 1`, 
            [email, cnpj, telefoneEmpresa]
        );

        if (checkResult.rows.length > 0) {
            const existing = checkResult.rows[0];
            let msg = "Dados já cadastrados.";
            if (existing.email === email) msg = "Este e-mail já possui cadastro.";
            else if (existing.cnpj === cnpj) msg = "Este CNPJ já está cadastrado.";
            else if (existing.whatsapp === telefoneEmpresa) msg = "Este WhatsApp já está em uso.";
            
            await checkClient.end();
            return res.status(409).json({ message: msg });
        }
    } catch (dbError) {
        await checkClient.end();
        console.error("[DB CHECK ERROR]", dbError);
        return res.status(500).json({ message: "Erro de conexão ao validar dados." });
    }
    await checkClient.end();

    let companyId = null; // ID da Empresa no Bitrix (CRUCIAL PARA O FIX)
    let contactId = null; // ID do Contato no Bitrix
    let asaasCustomerId = null;
    let bitrixLogoId = null;

    try {
        // 1. Validar Email no Bitrix
        const bitrixCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email }, select: ['ID']
        });
        if (bitrixCheck.data.result && bitrixCheck.data.result.length > 0) {
            return res.status(409).json({ message: "Este e-mail já existe no CRM externo." });
        }

        // 2. Upload Logo (Se houver)
        if (logo && logo.base64) {
            const base64Clean = logo.base64.split(';base64,').pop();
            const cleanName = logo.name.replace(/[^a-zA-Z0-9._-]/g, '');
            const finalName = `${cnpj.replace(/\D/g,'')}_${cleanName}`;
            bitrixLogoId = await uploadToBitrixDisk(BITRIX_LOGOS_FOLDER_ID, finalName, base64Clean);
        }

        // 3. Preparar Senha e Token
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);
        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ') || '';

        // 4. Criar EMPRESA no Bitrix
        console.log("[DEBUG] Criando Empresa no Bitrix...");
        const createCompanyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.add.json`, {
            fields: { TITLE: nomeEmpresa, PHONE: [{ VALUE: telefoneEmpresa, VALUE_TYPE: 'WORK' }], 'UF_CRM_CNPJ': cnpj }
        });
        companyId = createCompanyResponse.data.result;
        if(!companyId) throw new Error("Falha ao criar empresa no CRM");
        
        console.log(`[DEBUG] Empresa Bitrix criada. ID: ${companyId}`);

        // 5. Criar CONTATO no Bitrix (Vinculado à Empresa)
        console.log("[DEBUG] Criando Contato no Bitrix...");
        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: {
                NAME: firstName, LAST_NAME: lastName, EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                COMPANY_ID: companyId, // Vínculo importante
                'UF_CRM_1751824202': hashedPassword, 'UF_CRM_1751824225': sessionToken
            }
        });
        contactId = createContactResponse.data.result;
        if(!contactId) throw new Error("Falha ao criar contato no CRM");

        // 6. Criar Cliente no Asaas
        console.log("[DEBUG] Criando no Asaas...");
        const createAsaasResponse = await axios.post('https://www.asaas.com/api/v3/customers', {
            name: nomeEmpresa, cpfCnpj: cnpj, email: email, mobilePhone: telefoneEmpresa, externalReference: contactId
        }, { headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' } });
        asaasCustomerId = createAsaasResponse.data.id;

        // 7. Atualizar Contato Bitrix com ID Asaas
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId, fields: { 'UF_CRM_1748911653': asaasCustomerId }
        });

        // 8. SALVAR NO NEON (COM O FIX DO COMPANY ID)
        console.log("[DEBUG] Salvando no Banco Local...");
        const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            
            // --- QUERY ATUALIZADA AQUI ---
            // Inserimos 'companyId' na coluna 'bitrix_company_id'
            const sql = `
                INSERT INTO empresas (
                    cnpj, nome_fantasia, whatsapp, email, responsavel, 
                    bitrix_id, bitrix_company_id, asaas_id, logo_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                RETURNING id;
            `;
            
            // Valores correspondentes: bitrix_id = contactId, bitrix_company_id = companyId
            const values = [
                cnpj, nomeEmpresa, telefoneEmpresa, email, nomeResponsavel, 
                contactId, companyId, asaasCustomerId, bitrixLogoId
            ];
            
            const dbRes = await client.query(sql, values);
            const empresaLocalId = dbRes.rows[0].id;

            // BONUS: Já cria o registro na tabela crm_clientes para ele aparecer nas buscas
            await client.query(`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [empresaLocalId, nomeResponsavel, telefoneEmpresa]);

            console.log(`[DEBUG] Cadastro finalizado! ID Local: ${empresaLocalId}`);

        } catch (dbError) {
            console.error("ERRO CRÍTICO AO SALVAR NO NEON:", dbError.message);
            // Nota: Não fazemos rollback aqui pois os registros externos já existem.
            // O ideal seria logar em uma tabela de erros para retry manual.
        } finally {
            await client.end();
        }

        return res.status(200).json({
            success: true,
            message: "Conta criada com sucesso!",
            token: sessionToken,
            userName: firstName,
            contactId: contactId
        });

    } catch (error) {
        console.error('Erro no fluxo de cadastro:', error.message);
        // Tenta limpar o lixo no Bitrix se falhar no meio
        if (companyId && !contactId) axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e=>{});
        
        return res.status(500).json({ message: 'Erro ao processar cadastro. Por favor, tente novamente.' });
    }
};
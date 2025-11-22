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
        // 1. Obter URL de Upload do Bitrix
        const getUrlResponse = await axios.get(`${BITRIX24_API_URL}disk.folder.uploadfile.json`, {
            params: { id: folderId }
        });

        if (!getUrlResponse.data.result || !getUrlResponse.data.result.uploadUrl) {
            throw new Error("Bitrix não forneceu URL de upload.");
        }
        const uploadUrl = getUrlResponse.data.result.uploadUrl;

        // 2. Converter Base64 para Buffer (Binário)
        const fileBuffer = Buffer.from(base64Content, 'base64');

        // 3. Construir o corpo "multipart/form-data" manualmente
        // Isso evita precisar instalar a biblioteca 'form-data' no package.json
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
        const header = `--${boundary}\r\n` +
                       `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
                       `Content-Type: application/octet-stream\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;

        // Juntar as partes (Cabeçalho + Arquivo + Rodapé)
        const payload = Buffer.concat([
            Buffer.from(header, 'utf-8'),
            fileBuffer,
            Buffer.from(footer, 'utf-8')
        ]);

        // 4. Enviar para a URL que o Bitrix mandou
        const uploadResponse = await axios.post(uploadUrl, payload, {
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': payload.length
            }
        });

        // 5. Retornar o ID
        if (uploadResponse.data.result && uploadResponse.data.result.ID) {
            return uploadResponse.data.result.ID;
        }
        throw new Error("Upload concluído, mas sem ID na resposta final.");

    } catch (error) {
        console.error("[UPLOAD HELPER ERROR]", error.message);
        if (error.response) console.error("Bitrix Response:", error.response.data);
        return null;
    }
}

module.exports = async (req, res) => {
    console.log("[DEBUG] API /api/registerUser iniciada.");

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

    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    let companyId = null;
    let contactId = null;
    let asaasCustomerId = null;
    let bitrixLogoId = null;

    try {
        // 1. Verificar Email
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'EMAIL': email }, select: ['ID']
        });
        if (searchUserResponse.data.result && searchUserResponse.data.result.length > 0) {
            return res.status(409).json({ message: "Este e-mail já está cadastrado." });
        }

        // =================================================================
        // 2. UPLOAD DO LOGO (MÉTODO CORRIGIDO EM 2 ETAPAS)
        // =================================================================
        if (logo && logo.base64) {
            console.log(`[DEBUG] 2. Iniciando upload robusto para pasta: ${BITRIX_LOGOS_FOLDER_ID}`);
            
            // Limpa o prefixo data:image...
            const base64Clean = logo.base64.split(';base64,').pop();
            // Garante nome de arquivo seguro (sem acentos/espaços)
            const cleanName = logo.name.replace(/[^a-zA-Z0-9._-]/g, '');
            const finalName = `${cnpj.replace(/\D/g,'')}_${cleanName}`;

            // Chama nossa função auxiliar
            bitrixLogoId = await uploadToBitrixDisk(BITRIX_LOGOS_FOLDER_ID, finalName, base64Clean);
            
            if (bitrixLogoId) {
                console.log(`[DEBUG] SUCESSO! Logo salvo com ID: ${bitrixLogoId}`);
            } else {
                console.warn("[WARN] O upload falhou ou não retornou ID. O cadastro seguirá sem logo.");
            }
        }

        // 3. Segurança
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);

        // 4. Criar Empresa
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

        // 5. Criar Contato
        console.log("[DEBUG] 5. Criando Contato...");
        const nameParts = nomeResponsavel.split(' ');
        const createContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.add.json`, {
            fields: {
                NAME: nameParts.shift(),
                LAST_NAME: nameParts.join(' ') || '',
                EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                COMPANY_ID: companyId,
                'UF_CRM_1751824202': hashedPassword,
                'UF_CRM_1751824225': sessionToken
            }
        });
        contactId = createContactResponse.data.result;
        if (!contactId) throw new Error('Falha ao criar contato no CRM.');

        // 6. Criar Asaas
        console.log("[DEBUG] 6. Criando Cliente Asaas...");
        const createAsaasResponse = await axios.post('https://www.asaas.com/api/v3/customers', 
            {
                name: nomeEmpresa, cpfCnpj: cnpj, email: email, mobilePhone: telefoneEmpresa, externalReference: contactId
            },
            { headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' } }
        );
        asaasCustomerId = createAsaasResponse.data.id;

        // 7. Update Bitrix
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId, fields: { 'UF_CRM_1748911653': asaasCustomerId }
        });

        // 8. Salvar no Neon (Com o Logo ID correto agora)
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
            const values = [cnpj, nomeEmpresa, telefoneEmpresa, email, nomeResponsavel, contactId, asaasCustomerId, bitrixLogoId];
            
            const dbRes = await client.query(sql, values);
            console.log(`[DEBUG] SUCESSO FINAL! Salvo no Neon (ID: ${dbRes.rows[0].id}). LogoID: ${bitrixLogoId}`);

        } catch (dbError) {
            console.error("ERRO NEON:", dbError.message);
        } finally {
            await client.end();
        }

        return res.status(200).json({
            success: true,
            message: "Cadastro realizado com sucesso!",
            token: sessionToken,
            userName: nameParts[0],
            contactId: contactId
        });

    } catch (error) {
        console.error('Erro CRÍTICO:', error.message);
        if (companyId && !contactId) axios.post(`${BITRIX24_API_URL}crm.company.delete.json`, { id: companyId }).catch(e=>{});
        return res.status(500).json({ message: 'Erro ao processar cadastro.' });
    }
};
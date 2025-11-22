const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const BITRIX_LOGOS_FOLDER_ID = 251803;

// Função auxiliar de Upload (Reutilizada do registerUser)
async function uploadToBitrixDisk(folderId, filename, base64Content) {
    try {
        const getUrl = await axios.get(`${BITRIX24_API_URL}disk.folder.uploadfile.json`, { params: { id: folderId } });
        const uploadUrl = getUrl.data.result.uploadUrl;
        const fileBuffer = Buffer.from(base64Content, 'base64');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
        const payload = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf-8'),
            fileBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
        ]);
        const res = await axios.post(uploadUrl, payload, { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } });
        return res.data.result.ID;
    } catch (e) { console.error(e); return null; }
}

module.exports = async (req, res) => {
    // CORS...
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { token, nome_fantasia, whatsapp, responsavel, email, new_password, logo } = req.body;

    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        // 1. Identificar Usuário via Bitrix
        const bitrixCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': token },
            select: ['ID', 'NAME', 'LAST_NAME']
        });

        if (!bitrixCheck.data.result || bitrixCheck.data.result.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }
        const contactId = bitrixCheck.data.result[0].ID;

        // 2. Processar Upload de Nova Logo (se houver)
        let newLogoId = null;
        if (logo && logo.base64) {
            console.log("Atualizando logo...");
            const cleanName = logo.name.replace(/[^a-zA-Z0-9._-]/g, '');
            const base64Clean = logo.base64.split(';base64,').pop();
            newLogoId = await uploadToBitrixDisk(BITRIX_LOGOS_FOLDER_ID, `UPDATED_${cleanName}`, base64Clean);
        }

        // 3. Atualizar Neon DB
        await client.connect();
        
        // Montar Query Dinâmica (só atualiza senha e logo se foram enviados)
        let updateFields = [
            "nome_fantasia = $1",
            "whatsapp = $2",
            "responsavel = $3",
            "email = $4"
        ];
        let values = [nome_fantasia, whatsapp, responsavel, email];
        let paramCount = 5; // $1..$4 já usados, próximo é $5

        if (newLogoId) {
            updateFields.push(`logo_id = $${paramCount}`);
            values.push(newLogoId);
            paramCount++;
        }

        if (new_password) {
            // Se mudar senha no banco, precisa mudar no Bitrix também para o login continuar funcionando?
            // Seu sistema atual valida login pelo Bitrix ou Neon?
            // Assumindo que valida no Bitrix (loginUser.js busca no bitrix):
            const hashedPassword = await bcrypt.hash(new_password, 10);
            // Atualiza Bitrix com nova senha
            await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
                id: contactId,
                fields: { 'UF_CRM_1751824202': hashedPassword } // Campo de senha do Bitrix
            });
        }

        // Executa update no Neon
        values.push(contactId); // Último parâmetro é o ID de busca
        const sql = `UPDATE empresas SET ${updateFields.join(', ')} WHERE bitrix_id = $${values.length}`;
        
        await client.query(sql, values);

        // 4. Atualizar dados básicos no Bitrix (Nome e Email) para manter sincronia
        const nameParts = responsavel.split(' ');
        const firstName = nameParts.shift();
        const lastName = nameParts.join(' ');
        
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contactId,
            fields: { 
                'NAME': firstName, 
                'LAST_NAME': lastName,
                'EMAIL': [{ VALUE: email, VALUE_TYPE: 'WORK' }]
            }
        });

        return res.status(200).json({ success: true, message: 'Dados atualizados.' });

    } catch (error) {
        console.error("Erro updateUserData:", error.message);
        return res.status(500).json({ message: 'Erro ao atualizar dados.' });
    } finally {
        await client.end();
    }
};
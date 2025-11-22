// --- START OF FILE bitrixFileHelper.js ---
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
// ID da pasta no Bitrix onde os arquivos de PEDIDOS serão salvos.
// Você pode usar o mesmo da logo ou criar uma pasta "Arquivos de Pedidos" no seu Drive e pegar o ID.
// Para teste, use o mesmo ID que você já tem (251803), depois organizamos melhor.
const TARGET_FOLDER_ID = 251803; 

/**
 * Passo 1: Upload do arquivo (Base64) para o Bitrix
 */
async function uploadToBitrix(filename, base64Content) {
    try {
        // 1. Obter URL de upload
        const getUrlResponse = await axios.get(`${BITRIX24_API_URL}disk.folder.uploadfile.json`, {
            params: { id: TARGET_FOLDER_ID }
        });
        
        if (!getUrlResponse.data.result || !getUrlResponse.data.result.uploadUrl) {
            throw new Error("Bitrix não forneceu URL de upload.");
        }
        
        const uploadUrl = getUrlResponse.data.result.uploadUrl;

        // 2. Preparar o Payload
        const fileBuffer = Buffer.from(base64Content, 'base64');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
        
        const header = `--${boundary}\r\n` +
                       `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
                       `Content-Type: application/octet-stream\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;
        
        const payload = Buffer.concat([
            Buffer.from(header, 'utf-8'), 
            fileBuffer, 
            Buffer.from(footer, 'utf-8')
        ]);

        // 3. Enviar o arquivo físico
        const uploadResponse = await axios.post(uploadUrl, payload, {
            headers: { 
                'Content-Type': `multipart/form-data; boundary=${boundary}`, 
                'Content-Length': payload.length 
            }
        });

        if (uploadResponse.data.result && uploadResponse.data.result.ID) {
            return uploadResponse.data.result.ID;
        }
        return null;
    } catch (error) {
        console.error("[BITRIX UPLOAD ERROR]", error.message);
        throw error;
    }
}

/**
 * Passo 2: Gerar Link Público para um arquivo já upado (pelo ID)
 */
async function getPublicLink(fileId) {
    try {
        // Tenta obter o link externo
        const response = await axios.get(`${BITRIX24_API_URL}disk.file.getexternallink.json`, {
            params: { id: fileId }
        });

        if (response.data.result) {
            return response.data.result; // Retorna a URL pública
        }
        
        throw new Error("Não foi possível gerar o link público.");
    } catch (error) {
        console.error("[BITRIX LINK ERROR]", error.message);
        return null; // Retorna null se falhar, para não travar o pedido inteiro
    }
}

/**
 * Função Principal: Faz Upload e Retorna o Link
 */
async function uploadAndGetPublicLink(filename, base64Content) {
    const fileId = await uploadToBitrix(filename, base64Content);
    if (!fileId) return null;
    
    const publicLink = await getPublicLink(fileId);
    return publicLink;
}

module.exports = { uploadAndGetPublicLink };
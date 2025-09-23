// /api/impressao/downloadArquivo.js

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731'; // O campo customizado do link

/**
 * Converte uma URL de compartilhamento do Google Drive em uma URL de download direto.
 * Esta função é a mesma que tínhamos no frontend, agora no backend.
 */
function criarLinkDownloadGoogleDrive(shareUrl) {
    if (!shareUrl || typeof shareUrl !== 'string') return null;
    const regex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
    const match = shareUrl.match(regex);
    if (match && match[1]) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return null;
}

module.exports = async (req, res) => {
    try {
        const { dealId } = req.query; // Pegamos o ID da URL
        if (!dealId) {
            return res.status(400).json({ message: 'dealId é obrigatório.' });
        }

        // 1. Buscar o deal no Bitrix24 para obter o link do arquivo
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, { id: dealId });
        
        if (!dealResponse.data.result) {
            return res.status(404).json({ message: 'Negócio não encontrado.' });
        }
        
        const deal = dealResponse.data.result;
        const linkArquivoOriginal = deal[LINK_ARQUIVO_FINAL_FIELD];

        if (!linkArquivoOriginal) {
            return res.status(404).json({ message: 'Nenhum link de arquivo encontrado para este negócio.' });
        }
        
        // 2. Converter o link para download direto
        const linkDownloadDireto = criarLinkDownloadGoogleDrive(linkArquivoOriginal);

        if (!linkDownloadDireto) {
            // Se não for um link do Google Drive, redireciona o usuário para o link original
            console.warn('Link não é do Google Drive, redirecionando:', linkArquivoOriginal);
            return res.redirect(linkArquivoOriginal);
        }

        // 3. Fazer o download do arquivo do Google para o nosso servidor
        const fileResponse = await axios({
            method: 'GET',
            url: linkDownloadDireto,
            responseType: 'stream' // MUITO IMPORTANTE: para lidar com arquivos grandes
        });

        // 4. Preparar os headers para forçar o download no navegador do cliente
        // Tenta pegar o nome do arquivo do header 'content-disposition' do Google
        const contentDisposition = fileResponse.headers['content-disposition'];
        let filename = 'arquivo-final.cdr'; // Nome padrão
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^'";]+)['"]?/);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1]);
            }
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', fileResponse.headers['content-type'] || 'application/octet-stream');
        
        // 5. Enviar o arquivo (stream) para o cliente
        fileResponse.data.pipe(res);

    } catch (error) {
        console.error('Erro em /api/impressao/downloadArquivo:', error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao processar o download.' });
    }
};
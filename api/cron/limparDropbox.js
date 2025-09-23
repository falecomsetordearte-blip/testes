// /api/cron/limparDropbox.js

import { Dropbox } from 'dropbox';

// --- CONFIGURAÇÃO ---
// Para limpar a pasta raiz ("Todos os arquivos"), use uma string vazia.
const PASTA_ALVO = ''; 
const DIAS_PARA_EXPIRAR = 15;
// --------------------


export default async function handler(req, res) {
    // Segurança: Apenas permite que a Vercel (ou requisições com um token secreto) execute esta função.
    if (req.headers['x-vercel-cron-secret'] !== process.env.VERCEL_CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });
        const targetFolderName = PASTA_ALVO === '' ? 'pasta raiz' : PASTA_ALVO;
        console.log(`[CRON JOB] Iniciando limpeza da ${targetFolderName}`);

        // O 'path' como string vazia indica a pasta raiz
        const response = await dbx.filesListFolder({ path: PASTA_ALVO });
        const files = response.result.entries;

        const agora = new Date();
        let arquivosDeletados = 0;

        for (const file of files) {
            // Ignora se for uma pasta
            if (file['.tag'] !== 'file') {
                continue;
            }

            const dataModificacao = new Date(file.client_modified);
            const diffTime = Math.abs(agora - dataModificacao);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > DIAS_PARA_EXPIRAR) {
                console.log(`- Deletando arquivo: ${file.name} (antigo há ${diffDays} dias)`);
                await dbx.filesDeleteV2({ path: file.path_lower });
                arquivosDeletados++;
            }
        }
        
        const mensagem = `[CRON JOB] Limpeza concluída. ${arquivosDeletados} arquivos foram deletados da ${targetFolderName}.`;
        console.log(mensagem);
        res.status(200).send(mensagem);

    } catch (error) {
        console.error('[CRON JOB] Erro ao executar a limpeza do Dropbox:', error);
        res.status(500).json({ error: 'Falha ao executar a limpeza.' });
    }
}
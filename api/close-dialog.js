const axios = require('axios');

/**
 * Função auxiliar para fazer chamadas à API do Bitrix24.
 * @param {string} method - O método da API a ser chamado (ex: 'im.dialog.close').
 * @param {object} params - Os parâmetros para o método.
 * @returns {Promise<any>} - O resultado da chamada da API.
 */
async function callBitrixMethod(method, params) {
    // Pega a URL do webhook das variáveis de ambiente no Vercel.
    const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('A variável de ambiente BITRIX_WEBHOOK_URL não está configurada.');
    }

    // Monta a URL final para a chamada do método específico.
    const apiUrl = `${webhookUrl.replace(/\/$/, '')}/${method}`;

    try {
        const response = await axios.post(apiUrl, params);
        // Verifica se a API do Bitrix retornou um erro específico.
        if (response.data.error) {
            throw new Error(`Erro na API do Bitrix: ${response.data.error_description || response.data.error}`);
        }
        return response.data.result;
    } catch (error) {
        // Lança um erro mais detalhado em caso de falha na requisição.
        throw new Error(`Falha ao chamar o método '${method}': ${error.message}`);
    }
}

/**
 * Handler principal da função serverless.
 * Usamos module.exports para ser compatível com o seu setup CommonJS.
 */
module.exports = async (req, res) => {
    // 1. Validar o método da requisição (deve ser POST).
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    try {
        // 2. Extrair o ID do Negócio do corpo da requisição.
        // O Bitrix geralmente envia dados no formato 'document_id[2]=DEAL_1234'.
        // Este código é flexível para aceitar isso ou um JSON simples como { "dealId": "1234" }.
        let dealId;
        if (req.body.dealId) {
            dealId = req.body.dealId;
        } else if (req.body['document_id'] && req.body['document_id'][2]) {
            dealId = req.body['document_id'][2].replace('DEAL_', '');
        }

        if (!dealId) {
            console.log('Corpo da requisição recebido:', req.body);
            return res.status(400).json({ error: 'ID do negócio (dealId) não encontrado no corpo da requisição.' });
        }

        console.log(`Iniciando processo para o Negócio ID: ${dealId}`);

        // 3. Encontrar o ID do diálogo associado ao negócio.
        console.log(`Buscando diálogo para o Negócio ID: ${dealId}...`);
        const dialogs = await callBitrixMethod('im.dialog.get', {
            CRM_ENTITY_TYPE: 'DEAL',
            CRM_ENTITY_ID: dealId,
        });

        // O resultado é um objeto onde as chaves são os IDs dos diálogos. Pegamos o primeiro.
        const dialogId = Object.keys(dialogs)[0];

        if (!dialogId) {
            // Se não houver diálogo, não é um erro. Apenas informamos e encerramos com sucesso.
            console.log(`Nenhum diálogo aberto encontrado para o Negócio ID: ${dealId}`);
            return res.status(200).json({ message: 'Nenhum diálogo aberto encontrado para este negócio. Nenhuma ação necessária.' });
        }

        console.log(`Diálogo encontrado: ${dialogId}. Fechando...`);

        // 4. Fechar o diálogo encontrado.
        const closeResult = await callBitrixMethod('im.dialog.close', {
            DIALOG_ID: dialogId,
        });

        if (closeResult === true) {
            console.log(`Diálogo ${dialogId} fechado com sucesso para o Negócio ID: ${dealId}.`);
            return res.status(200).json({ success: true, message: `Diálogo ${dialogId} fechado com sucesso.` });
        } else {
            // Caso a API retorne 'false' sem dar erro.
            throw new Error('A API do Bitrix retornou "false" para im.dialog.close, indicando que o diálogo não foi fechado.');
        }

    } catch (error) {
        console.error('Ocorreu um erro:', error.message);
        return res.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
    }
};
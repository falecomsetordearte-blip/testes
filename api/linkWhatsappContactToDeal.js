// /api/linkWhatsappContactToDeal.js - Versão adaptada para URL (GET)

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const INTERNAL_WEBHOOK_TOKEN = process.env.INTERNAL_WEBHOOK_TOKEN;

/**
 * Função auxiliar para encontrar um contato pelo nome e vinculá-lo a um negócio.
 * @param {string} dealId - O ID do negócio ao qual o contato será vinculado.
 * @param {string} contactNameToFind - O nome exato do contato a ser procurado.
 */
const findAndLinkContact = async (dealId, contactNameToFind) => {
    try {
        console.log(`[INFO] Procurando por contato: "${contactNameToFind}"`);

        // 1. Busca o contato pelo nome
        const searchContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'NAME': contactNameToFind },
            select: ['ID']
        });

        const contact = searchContactResponse.data.result[0];

        // 2. Verifica se o contato foi encontrado
        if (!contact) {
            console.warn(`[AVISO] Contato "${contactNameToFind}" não encontrado.`);
            // Retorna para não interromper a execução caso um dos contatos não exista
            return; 
        }

        console.log(`[INFO] Contato "${contactNameToFind}" encontrado. ID: ${contact.ID}`);
        const contactId = contact.ID;

        // 3. Vincula o contato encontrado ao negócio
        await axios.post(`${BITRIX24_API_URL}crm.deal.contact.add.json`, {
            id: dealId,
            fields: { CONTACT_ID: contactId }
        });

        console.log(`[SUCESSO] Contato ${contactId} ("${contactNameToFind}") vinculado ao negócio ${dealId}.`);
    } catch (error) {
        // Lança o erro para que o bloco catch principal possa capturá-lo
        console.error(`Erro ao processar o contato "${contactNameToFind}":`, error.response ? error.response.data : error.message);
        throw error; 
    }
};

module.exports = async (req, res) => {
    // Agora aceitamos GET, pois o Bitrix24 envia assim
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // Lendo os dados da URL (req.query)
        const { dealTitle, dealId, token } = req.query;

        // Validação de segurança
        if (INTERNAL_WEBHOOK_TOKEN && token !== INTERNAL_WEBHOOK_TOKEN) {
            console.warn('Tentativa de acesso não autorizado ao webhook.');
            return res.status(401).json({ message: 'Token de acesso inválido.' });
        }

        if (!dealTitle || !dealId) {
            return res.status(400).json({ message: 'dealTitle e dealId são obrigatórios.' });
        }

        // Nomes dos dois contatos a serem procurados
        const whatsappContactName = `WhatsApp group - ${dealTitle} | ${dealId}`;
        const designerContactName = `Designer | ${dealId}`;

        // Executa as duas operações de busca e vínculo em paralelo
        await Promise.all([
            findAndLinkContact(dealId, whatsappContactName),
            findAndLinkContact(dealId, designerContactName)
        ]);

        console.log(`[FINAL] Processamento de vinculação de contatos concluído para o negócio ${dealId}.`);
        // O Bitrix24 espera uma resposta de texto simples em webhooks de saída
        return res.status(200).send('Sucesso');

    } catch (error) {
        // O erro já foi logado na função auxiliar
        console.error('Erro geral no webhook:', error.message);
        return res.status(500).send('Erro Interno');
    }
};
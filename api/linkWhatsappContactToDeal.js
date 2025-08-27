// /api/linkWhatsappContactToDeal.js - Versão adaptada para URL (GET)

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const INTERNAL_WEBHOOK_TOKEN = process.env.INTERNAL_WEBHOOK_TOKEN;

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

        const contactNameToFind = `WhatsApp group - ${dealTitle} | ${dealId}`;
        console.log(`[INFO] Procurando por contato: "${contactNameToFind}"`);

        const searchContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'NAME': contactNameToFind },
            select: ['ID']
        });

        const contact = searchContactResponse.data.result[0];

        if (!contact) {
            console.warn(`[AVISO] Contato "${contactNameToFind}" não encontrado.`);
            // Respondemos 200 para o Bitrix24 não marcar como erro
            return res.status(200).json({ success: false, message: 'Contato não encontrado.' });
        }

        console.log(`[INFO] Contato encontrado. ID: ${contact.ID}`);
        const contactId = contact.ID;

        await axios.post(`${BITRIX24_API_URL}crm.deal.contact.add.json`, {
            id: dealId,
            fields: { CONTACT_ID: contactId }
        });

        console.log(`[SUCESSO] Contato ${contactId} vinculado ao negócio ${dealId}.`);
        // O Bitrix24 espera uma resposta de texto simples em webhooks de saída
        return res.status(200).send('Sucesso');

    } catch (error) {
        console.error('Erro no webhook:', error.response ? error.response.data : error.message);
        return res.status(500).send('Erro Interno');
    }
};

// /api/linkWhatsappContactToDeal.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
// Recomendação: Crie um token secreto para este webhook para maior segurança
const INTERNAL_WEBHOOK_TOKEN = process.env.INTERNAL_WEBHOOK_TOKEN; 

module.exports = async (req, res) => {
    // Validação de segurança (opcional, mas altamente recomendado)
    const providedToken = req.headers['x-webhook-token'];
    if (INTERNAL_WEBHOOK_TOKEN && providedToken !== INTERNAL_WEBHOOK_TOKEN) {
        console.warn('Tentativa de acesso não autorizado ao webhook linkWhatsappContactToDeal.');
        return res.status(401).json({ message: 'Acesso não autorizado.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { dealTitle, dealId } = req.body;
        if (!dealTitle || !dealId) {
            return res.status(400).json({ message: 'dealTitle e dealId são obrigatórios.' });
        }

        // ETAPA 1: Montar o nome exato do contato a ser procurado
        const contactNameToFind = `WhatsApp group - ${dealTitle} | ${dealId}`;
        console.log(`[INFO] Procurando por contato com o nome: "${contactNameToFind}"`);

        // ETAPA 2: Encontrar o contato no Bitrix24
        const searchContactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'NAME': contactNameToFind },
            select: ['ID', 'NAME']
        });

        const contact = searchContactResponse.data.result[0];

        if (!contact) {
            console.warn(`[AVISO] Contato "${contactNameToFind}" não foi encontrado. Nenhuma ação foi tomada.`);
            return res.status(404).json({ message: 'Contato não encontrado.' });
        }

        console.log(`[INFO] Contato encontrado. ID: ${contact.ID}`);
        const contactId = contact.ID;

        // ETAPA 3: Adicionar o contato encontrado ao negócio
        const bindContactResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.contact.add.json`, {
            id: dealId,
            fields: {
                CONTACT_ID: contactId
            }
        });

        if (!bindContactResponse.data.result) {
            throw new Error(`Falha ao vincular o contato ${contactId} ao negócio ${dealId}.`);
        }

        console.log(`[SUCESSO] Contato ${contactId} vinculado com sucesso ao negócio ${dealId}.`);
        return res.status(200).json({ success: true, message: 'Contato vinculado com sucesso.' });

    } catch (error) {
        console.error('Erro ao vincular contato ao negócio:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno.' });
    }
};

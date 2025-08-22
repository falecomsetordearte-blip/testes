// /api/generatePixForDeal.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId } = req.body;
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Token e ID do pedido são obrigatórios.' });
        }

        // ETAPA 1: Encontrar o contato para pegar o Asaas Customer ID
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['UF_CRM_1748911653'] // Campo do Asaas Customer ID
        });

        const user = userSearch.data.result[0];
        const asaasCustomerId = user ? user.UF_CRM_1748911653 : null;

        if (!asaasCustomerId) {
            return res.status(404).json({ message: 'ID de cliente para pagamento não encontrado. Contate o suporte.' });
        }

        // ETAPA 2: Obter os dados do pedido (valor e título)
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // ETAPA 3: Gerar a cobrança no Asaas
        const paymentData = {
            customer: asaasCustomerId,
            billingType: 'PIX',
            value: parseFloat(deal.OPPORTUNITY),
            dueDate: new Date().toISOString().split('T')[0],
            description: `Pagamento referente ao pedido #${deal.ID}: ${deal.TITLE}`,
            externalReference: `Pedido ${deal.ID}` // Referência para o webhook
        };

        const asaasResponse = await axios.post(`${ASAAS_API_URL}/payments`, paymentData, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        return res.status(200).json({ success: true, url: asaasResponse.data.invoiceUrl });

    } catch (error) {
        console.error('Erro ao gerar PIX para pedido:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Não foi possível gerar a cobrança. Tente novamente.' });
    }
};

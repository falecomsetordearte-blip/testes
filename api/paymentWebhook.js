// /api/paymentWebhook.js - VERSÃO CORRIGIDA E FINAL

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const BITRIX_SALDO_FIELD = 'UF_CRM_1751913325'; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // --- CORREÇÃO APLICADA AQUI ---
        // Agora estamos lendo o header correto que o Asaas envia.
        const receivedToken = req.headers['asaas-access-token']; 

        if (!ASAAS_WEBHOOK_TOKEN || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            console.warn('Tentativa de acesso ao webhook com token inválido ou ausente.');
            return res.status(401).send('Acesso não autorizado.');
        }

        const { event, payment } = req.body;

        if (event === 'PAYMENT_RECEIVED' && payment && payment.externalReference === 'Créditos') {
            const asaasCustomerId = payment.customer;
            const valorRecebido = parseFloat(payment.value);

            const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
                filter: { 'UF_CRM_1748911653': asaasCustomerId },
                select: ['ID', BITRIX_SALDO_FIELD]
            });

            const user = searchResponse.data.result[0];

            if (user) {
                const saldoAtual = parseFloat(user[BITRIX_SALDO_FIELD] || 0);
                const novoSaldo = saldoAtual + valorRecebido;

                await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
                    id: user.ID,
                    fields: { [BITRIX_SALDO_FIELD]: novoSaldo.toFixed(2) }
                });
                console.log(`SUCESSO: Créditos adicionados para o contato ID ${user.ID}. Novo saldo: ${novoSaldo.toFixed(2)}`);
            } else {
                 console.warn(`AVISO: Pagamento recebido para o cliente Asaas ${asaasCustomerId}, mas nenhum contato correspondente foi encontrado no Bitrix24.`);
            }
        }

        return res.status(200).send('Webhook recebido com sucesso.');

    } catch (error) {
        console.error('ERRO CRÍTICO no webhook:', error.response ? error.response.data : error.message);
        return res.status(200).send('Erro interno ao processar webhook.');
    }
};

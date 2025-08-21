// /api/paymentWebhook.js - VERSÃO DE DEPURAÇÃO

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const BITRIX_SALDO_FIELD = 'UF_CRM_1751913325'; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        console.log("--- NOVO WEBHOOK RECEBIDO DO ASAAS ---");

        const receivedToken = req.headers['asaas-webhook-token'];
        if (!ASAAS_WEBHOOK_TOKEN || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            console.warn('TOKEN INVÁLIDO. Abortando.');
            return res.status(401).send('Acesso não autorizado.');
        }

        console.log("Token de segurança validado com sucesso.");

        const { event, payment } = req.body;

        // Logando os dados recebidos para análise
        console.log(`Evento recebido: ${event}`);
        if (payment) {
            console.log(`Referência Externa (externalReference): ${payment.externalReference}`);
            console.log(`ID do Cliente Asaas (customer): ${payment.customer}`);
        } else {
            console.log("Objeto 'payment' não encontrado no corpo da requisição.");
        }

        // Condição para processar o pagamento
        if (event === 'PAYMENT_RECEIVED' && payment && payment.externalReference === 'Créditos') {
            
            console.log("CONDIÇÕES ATENDIDAS. Processando adição de créditos...");
            
            const asaasCustomerId = payment.customer;
            const valorRecebido = parseFloat(payment.value);

            console.log(`Buscando no Bitrix24 pelo Asaas Customer ID: ${asaasCustomerId}`);
            const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
                filter: { 'UF_CRM_1748911653': asaasCustomerId },
                select: ['ID', BITRIX_SALDO_FIELD]
            });

            const user = searchResponse.data.result[0];

            if (user) {
                console.log(`Usuário encontrado no Bitrix24. ID do Contato: ${user.ID}`);
                const saldoAtual = parseFloat(user[BITRIX_SALDO_FIELD] || 0);
                const novoSaldo = saldoAtual + valorRecebido;
                console.log(`Saldo atual: ${saldoAtual}. Valor recebido: ${valorRecebido}. Novo saldo: ${novoSaldo}`);

                await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
                    id: user.ID,
                    fields: { [BITRIX_SALDO_FIELD]: novoSaldo.toFixed(2) }
                });
                console.log(`SUCESSO: Créditos adicionados para o contato ID ${user.ID}.`);
            } else {
                 console.warn(`AVISO: Usuário não encontrado no Bitrix24 com o Asaas Customer ID ${asaasCustomerId}.`);
            }
        } else {
            console.log("Condições para processar o pagamento não foram atendidas. Nenhuma ação será tomada.");
        }

        return res.status(200).send('Webhook recebido com sucesso.');

    } catch (error) {
        console.error('ERRO CRÍTICO no webhook:', error.response ? error.response.data : error.message);
        return res.status(200).send('Erro interno ao processar webhook.');
    }
};

// /api/paymentWebhook.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN; // Token de segurança

// O campo de saldo foi atualizado aqui com a informação que você enviou.
const BITRIX_SALDO_FIELD = 'UF_CRM_1751913325'; 

module.exports = async (req, res) => {
    // Apenas o método POST é permitido para webhooks
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // ETAPA DE SEGURANÇA: Validar o token do Asaas
        const receivedToken = req.headers['asaas-webhook-token'];

        // Se o token não existir ou não for igual ao configurado, a requisição é rejeitada.
        if (!ASAAS_WEBHOOK_TOKEN || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            console.warn('Tentativa de acesso ao webhook de pagamento com token inválido.');
            return res.status(401).send('Acesso não autorizado.');
        }

        const { event, payment } = req.body;

        // Processar apenas pagamentos recebidos e que foram gerados para "Créditos"
        if (event === 'PAYMENT_RECEIVED' && payment && payment.externalReference === 'Créditos') {
            
            const asaasCustomerId = payment.customer;
            const valorRecebido = parseFloat(payment.value);

            // Encontrar o contato no Bitrix24 pelo ID do cliente Asaas
            const searchResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
                filter: { 'UF_CRM_1748911653': asaasCustomerId }, // Campo da ID do cliente Asaas
                select: ['ID', BITRIX_SALDO_FIELD] // Seleciona o ID e o campo de saldo
            });

            const user = searchResponse.data.result[0];

            if (user) {
                // Atualizar o saldo do usuário encontrado
                const saldoAtual = parseFloat(user[BITRIX_SALDO_FIELD] || 0);
                const novoSaldo = saldoAtual + valorRecebido;

                // Salva a atualização no Bitrix24
                await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
                    id: user.ID,
                    fields: {
                        [BITRIX_SALDO_FIELD]: novoSaldo.toFixed(2) // Garante que o valor terá 2 casas decimais
                    }
                });
                console.log(`Créditos adicionados para o contato ID ${user.ID}. Novo saldo: ${novoSaldo.toFixed(2)}`);
            } else {
                 console.warn(`Pagamento recebido para o cliente Asaas ${asaasCustomerId}, mas nenhum contato correspondente foi encontrado no Bitrix24.`);
            }
        }

        // Responder ao Asaas para confirmar o recebimento do webhook
        return res.status(200).send('Webhook recebido com sucesso.');

    } catch (error) {
        console.error('Erro no webhook de pagamento Asaas:', error.response ? error.response.data : error.message);
        // Mesmo em caso de erro, respondemos 200 para o Asaas não ficar reenviando a notificação.
        // O erro já foi logado no Vercel para você investigar.
        return res.status(200).send('Erro interno ao processar webhook.');
    }
};

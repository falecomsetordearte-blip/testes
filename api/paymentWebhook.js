// /api/paymentWebhook.js - VERSÃO OTIMIZADA E FINAL

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const BITRIX_SALDO_FIELD = 'UF_CRM_1751913325';
const ASAAS_CUSTOMER_ID_FIELD = 'UF_CRM_1748911653';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const receivedToken = req.headers['asaas-access-token'];
        if (!ASAAS_WEBHOOK_TOKEN || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            console.warn('Tentativa de acesso ao webhook com token inválido.');
            return res.status(401).send('Acesso não autorizado.');
        }

        const { event, payment } = req.body;

        if (event === 'PAYMENT_RECEIVED' && payment) {

            // CASO 1: Pagamento para adicionar créditos ao saldo da COMPANY
            if (payment.externalReference === 'Créditos') {
                console.log("[INFO] Processando ADIÇÃO DE CRÉDITOS.");
                const asaasCustomerId = payment.customer;
                const valorRecebido = parseFloat(payment.value);

                const contactSearchResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
                    filter: { [ASAAS_CUSTOMER_ID_FIELD]: asaasCustomerId },
                    select: ['ID', 'COMPANY_ID']
                });
                const contact = contactSearchResponse.data.result[0];

                if (contact && contact.COMPANY_ID) {
                    const companyId = contact.COMPANY_ID;
                    const companyGetResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId });
                    const company = companyGetResponse.data.result;

                    if (company) {
                        const saldoAtual = parseFloat(company[BITRIX_SALDO_FIELD] || 0);
                        const novoSaldo = saldoAtual + valorRecebido;
                        await axios.post(`${BITRIX24_API_URL}crm.company.update.json`, {
                            id: companyId,
                            fields: { [BITRIX_SALDO_FIELD]: novoSaldo.toFixed(2) }
                        });
                        console.log(`[SUCESSO] Saldo da EMPRESA ID ${companyId} atualizado para R$ ${novoSaldo.toFixed(2)}.`);
                    }
                } else {
                    console.warn(`[AVISO] Contato com Asaas ID ${asaasCustomerId} não encontrado ou sem empresa para adicionar créditos.`);
                }
            }
            // CASO 2: Pagamento de um pedido específico (DEAL)
            else if (payment.externalReference && payment.externalReference.startsWith('Pedido ')) {
                console.log("[INFO] Processando PAGAMENTO DE PEDIDO.");
                const dealId = payment.externalReference.replace('Pedido ', '');
                console.log(`[INFO] ID do Pedido identificado: ${dealId}`);

                // Ação: Mudar a etapa do negócio para "Pago"
                await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
                    id: dealId,
                    fields: { 
                        'STAGE_ID': 'C17:UC_2OEE24' // Etapa de "Pago" ou "Em Andamento"
                    }
                });
                console.log(`[SUCESSO] Pedido ID ${dealId} movido para a etapa de pago.`);
            }
            else {
                console.log(`[INFO] Pagamento recebido com referência desconhecida: "${payment.externalReference}". Nenhuma ação foi tomada.`);
            }
        }

        return res.status(200).send('Webhook recebido com sucesso.');

    } catch (error) {
        console.error('ERRO CRÍTICO no webhook:', error.response ? error.response.data : error.message);
        // Responde 200 para o Asaas não pausar a fila, mas loga o erro para nós.
        return res.status(200).send('Erro interno ao processar webhook.');
    }
};

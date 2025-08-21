// /api/paymentWebhook.js - VERSÃO FINAL (Atualiza a EMPRESA)

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

// O campo de saldo da EMPRESA
const BITRIX_SALDO_FIELD = 'UF_CRM_1751913325'; 
// O campo que armazena a ID do cliente Asaas no CONTATO
const ASAAS_CUSTOMER_ID_FIELD = 'UF_CRM_1748911653';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const receivedToken = req.headers['asaas-access-token']; 

        if (!ASAAS_WEBHOOK_TOKEN || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            console.warn('Tentativa de acesso ao webhook com token inválido ou ausente.');
            return res.status(401).send('Acesso não autorizado.');
        }

        const { event, payment } = req.body;

        if (event === 'PAYMENT_RECEIVED' && payment && payment.externalReference === 'Créditos') {
            
            const asaasCustomerId = payment.customer;
            const valorRecebido = parseFloat(payment.value);

            // ETAPA 1: Encontrar o CONTATO pelo ID do cliente Asaas para obter o COMPANY_ID
            console.log(`Buscando CONTATO com Asaas ID: ${asaasCustomerId}`);
            const contactSearchResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
                filter: { [ASAAS_CUSTOMER_ID_FIELD]: asaasCustomerId },
                select: ['ID', 'COMPANY_ID'] // Precisamos do ID da Empresa associada
            });

            const contact = contactSearchResponse.data.result[0];

            if (contact && contact.COMPANY_ID) {
                const companyId = contact.COMPANY_ID;
                console.log(`Contato encontrado (ID: ${contact.ID}). EMPRESA associada (ID: ${companyId})`);

                // ETAPA 2: Obter os dados da EMPRESA para ler o saldo atual
                const companyGetResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, {
                    id: companyId
                });
                
                const company = companyGetResponse.data.result;

                if (company) {
                    // ETAPA 3: Calcular o novo saldo e ATUALIZAR A EMPRESA
                    const saldoAtual = parseFloat(company[BITRIX_SALDO_FIELD] || 0);
                    const novoSaldo = saldoAtual + valorRecebido;

                    await axios.post(`${BITRIX24_API_URL}crm.company.update.json`, {
                        id: companyId,
                        fields: { 
                            [BITRIX_SALDO_FIELD]: novoSaldo.toFixed(2)
                        }
                    });
                    console.log(`SUCESSO: Saldo da EMPRESA ID ${companyId} atualizado. Novo saldo: ${novoSaldo.toFixed(2)}`);
                } else {
                    console.warn(`AVISO: Empresa com ID ${companyId} não foi encontrada no Bitrix24.`);
                }

            } else {
                 console.warn(`AVISO: Pagamento recebido, mas o Contato com Asaas ID ${asaasCustomerId} não foi encontrado ou não está associado a uma Empresa.`);
            }
        }

        return res.status(200).send('Webhook recebido com sucesso.');

    } catch (error) {
        console.error('ERRO CRÍTICO no webhook:', error.response ? error.response.data : error.message);
        return res.status(200).send('Erro interno ao processar webhook.');
    }
};

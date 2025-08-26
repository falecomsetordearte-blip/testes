// /api/paymentWebhook.js - VERSÃO COM DEPURAÇÃO DETALHADA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const BITRIX_SALDO_FIELD = 'UF_CRM_1751913325'; 
const ASAAS_CUSTOMER_ID_FIELD = 'UF_CRM_1748911653';

module.exports = async (req, res) => {
    console.log("--- [WEBHOOK ASAAS] Nova requisição recebida ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // PONTO DE VERIFICAÇÃO 1: TOKEN DE SEGURANÇA
        console.log("[DEBUG] Verificando token de segurança...");
        const receivedToken = req.headers['asaas-access-token']; 
        if (!ASAAS_WEBHOOK_TOKEN || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            console.warn(`[FALHA] Token inválido. Esperado: [${ASAAS_WEBHOOK_TOKEN}], Recebido: [${receivedToken}]`);
            return res.status(401).send('Acesso não autorizado.');
        }
        console.log("[SUCESSO] Token validado.");

        // CASO 1: Pagamento para adicionar créditos ao saldo
            if (payment.externalReference === 'Créditos') {
                console.log("[INFO] Processando pagamento de ADIÇÃO DE CRÉDITOS.");
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
                }
            }
            // CASO 2: Pagamento de um pedido específico
            else if (payment.externalReference && payment.externalReference.startsWith('Pedido ')) {
                console.log("[INFO] Processando pagamento de PEDIDO ESPECÍFICO.");
                const dealId = payment.externalReference.replace('Pedido ', ''); // Extrai o ID do pedido
                console.log(`[INFO] ID do Pedido identificado: ${dealId}`);

                // Simplesmente muda a etapa do negócio para "Pago/Em Andamento"
                await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
                    id: dealId,
                    fields: { 
                        'STAGE_ID': 'C17:1' // IMPORTANTE: Etapa de "Pago" ou "Em Andamento"
                    }
                });
                console.log(`[SUCESSO] Pedido ID ${dealId} movido para a etapa de pago.`);
            }
        }

        return res.status(200).send('Webhook recebido com sucesso.');
            const valorRecebido = parseFloat(payment.value);
            console.log(`[INFO] Processando R$ ${valorRecebido} para Asaas Customer ID: ${asaasCustomerId}`);

            // PONTO DE VERIFICAÇÃO 4: BUSCA DO CONTATO
            console.log(`[DEBUG] Buscando contato no Bitrix24 com o campo ${ASAAS_CUSTOMER_ID_FIELD} = ${asaasCustomerId}`);
            const contactSearchResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
                filter: { [ASAAS_CUSTOMER_ID_FIELD]: asaasCustomerId },
                select: ['ID', 'COMPANY_ID']
            });
            const contact = contactSearchResponse.data.result[0];

            if (contact && contact.COMPANY_ID) {
                const companyId = contact.COMPANY_ID;
                console.log(`[SUCESSO] Contato encontrado (ID: ${contact.ID}). Empresa associada (ID: ${companyId})`);

                // PONTO DE VERIFICAÇÃO 5: BUSCA DA EMPRESA
                console.log(`[DEBUG] Buscando dados da empresa ID: ${companyId}`);
                const companyGetResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId });
                const company = companyGetResponse.data.result;

                if (company) {
                    // PONTO DE VERIFICAÇÃO 6: ATUALIZAÇÃO DO SALDO
                    const saldoAtual = parseFloat(company[BITRIX_SALDO_FIELD] || 0);
                    const novoSaldo = saldoAtual + valorRecebido;
                    console.log(`[INFO] Saldo atual: R$ ${saldoAtual.toFixed(2)}. Novo saldo será: R$ ${novoSaldo.toFixed(2)}`);
                    
                    console.log(`[DEBUG] Enviando atualização para o campo ${BITRIX_SALDO_FIELD} da empresa ID ${companyId}...`);
                    await axios.post(`${BITRIX24_API_URL}crm.company.update.json`, {
                        id: companyId,
                        fields: { [BITRIX_SALDO_FIELD]: novoSaldo.toFixed(2) }
                    });
                    console.log(`[SUCESSO FINAL] Saldo da empresa ID ${companyId} atualizado.`);
                } else {
                    console.warn(`[FALHA] Empresa com ID ${companyId} não foi encontrada no Bitrix24.`);
                }
            } else {
                 console.warn(`[FALHA] Contato com Asaas ID ${asaasCustomerId} não foi encontrado ou não está associado a uma empresa.`);
            }
        } else {
            console.log("[INFO] Condições não atendidas. Nenhuma ação será tomada.");
        }

        return res.status(200).send('Webhook recebido com sucesso.');

    } catch (error) {
        console.error('--- [ERRO CRÍTICO NO WEBHOOK] ---');
        if (error.response) {
            console.error("ERRO DETALHADO DA API:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("ERRO GERAL:", error.message);
        }
        return res.status(200).send('Erro interno ao processar webhook.');
    }
};

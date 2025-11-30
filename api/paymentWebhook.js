// /api/paymentWebhook.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const ASAAS_CUSTOMER_ID_FIELD = 'UF_CRM_1748911653';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const receivedToken = req.headers['asaas-access-token'];
        if (!ASAAS_WEBHOOK_TOKEN || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            return res.status(401).send('Acesso não autorizado.');
        }

        const { event, payment } = req.body;

        if (event === 'PAYMENT_RECEIVED' && payment) {

            // CASO 1: Recarga de Saldo (Carteira)
            if (payment.externalReference === 'Créditos') {
                console.log("[WEBHOOK] Recebido pagamento para CRÉDITOS.");
                const asaasCustomerId = payment.customer;
                const valorRecebido = parseFloat(payment.value);

                // 1. Achar empresa pelo ID do Asaas no Bitrix
                const contactResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
                    filter: { [ASAAS_CUSTOMER_ID_FIELD]: asaasCustomerId },
                    select: ['ID', 'COMPANY_ID']
                });
                
                const contact = contactResponse.data.result ? contactResponse.data.result[0] : null;

                if (contact && contact.COMPANY_ID) {
                    // 2. ATUALIZAR BANCO LOCAL (NEON) VIA SQL PURO
                    // Adiciona o valor ao saldo existente
                    await prisma.$executeRawUnsafe(
                        `UPDATE empresas 
                         SET saldo = COALESCE(saldo, 0) + $1 
                         WHERE bitrix_company_id = $2`,
                        valorRecebido,
                        parseInt(contact.COMPANY_ID)
                    );

                    // 3. Registrar Histórico
                    const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE bitrix_company_id = $1`, parseInt(contact.COMPANY_ID));
                    if (empresas.length > 0) {
                        await prisma.historicoFinanceiro.create({
                            data: {
                                empresa_id: empresas[0].id,
                                valor: valorRecebido,
                                tipo: 'ENTRADA',
                                descricao: 'Recarga de Saldo (Pix/Cartão)',
                                deal_id: 'RECARGA',
                                data: new Date()
                            }
                        });
                    }

                    console.log(`[SUCESSO] R$ ${valorRecebido} adicionados à empresa Bitrix ID ${contact.COMPANY_ID}`);
                }
            }
            // CASO 2: Pagamento de Pedido Específico (Se houver lógica futura)
            else if (payment.externalReference && payment.externalReference.startsWith('Pedido ')) {
                const dealId = payment.externalReference.replace('Pedido ', '');
                // Atualiza status no Bitrix
                await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
                    id: dealId,
                    fields: { 'STAGE_ID': 'C17:UC_2OEE24' } // Pago
                });
            }
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Erro Webhook:', error.message);
        return res.status(200).send('Erro processado.'); // 200 para não travar fila
    }
};
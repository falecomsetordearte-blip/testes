// api/asaas/webhook.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const event = req.body;
        console.log("Webhook Asaas:", event.event);
        if (!event || !event.payment) return res.status(200).json({ received: true });

        const payment = event.payment;
        const asaasSubscriptionId = payment.subscription; 

        if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
            if (asaasSubscriptionId) {
                await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, asaasSubscriptionId);
                await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, asaasSubscriptionId);
                console.log(`Assinatura ${asaasSubscriptionId} ativada.`);
            }
        } else if (event.event === 'PAYMENT_OVERDUE' || event.event === 'PAYMENT_DELETED') {
            if (asaasSubscriptionId) {
                await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1`, asaasSubscriptionId);
                await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1`, asaasSubscriptionId);
                console.log(`Assinatura ${asaasSubscriptionId} inativada.`);
            }
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Erro no Webhook Asaas:", error);
        return res.status(500).json({ message: 'Erro no webhook.' });
    }
};

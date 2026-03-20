// /api/asaas/webhook.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const event = req.body;
        console.log(`[WEBHOOK ASAAS] Evento: ${event.event}`);

        if (!event.payment || !event.payment.subscription) {
            return res.status(200).json({ received: true });
        }

        const subId = event.payment.subscription;

        // Se o pagamento foi confirmado ou recebido
        if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event.event)) {
            console.log(`[WEBHOOK] Ativando assinatura: ${subId}`);
            // Ativa em ambas as tabelas (o ID é único)
            await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, subId);
            await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, subId);
        } 
        
        // Se a assinatura foi cancelada ou venceu
        else if (['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'SUBSCRIPTION_DELETED'].includes(event.event)) {
            console.log(`[WEBHOOK] Inativando assinatura: ${subId}`);
            await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1`, subId);
            await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1`, subId);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Erro no Webhook:", error.message);
        return res.status(500).json({ message: 'Erro interno no webhook.' });
    }
};
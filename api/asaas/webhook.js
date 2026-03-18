// api/asaas/webhook.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const event = req.body;
        console.log("Recebido Webhook Asaas:", event.event);

        if (!event || !event.payment) {
            return res.status(200).json({ received: true }); // Asaas exige retorno 200 rápido
        }

        const payment = event.payment;
        const asaasSubscriptionId = payment.subscription; 

        // Só nos interessa pagamentos confirmados/recebidos atrelados a uma assinatura
        if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
            
            if (asaasSubscriptionId) {
                // Atualizar Empresa
                await prisma.$executeRawUnsafe(`
                    UPDATE empresas 
                    SET assinatura_status = 'ACTIVE' 
                    WHERE asaas_subscription_id = $1
                `, asaasSubscriptionId);

                // Atualizar Designer
                await prisma.$executeRawUnsafe(`
                    UPDATE designers_financeiro 
                    SET assinatura_status = 'ACTIVE' 
                    WHERE asaas_subscription_id = $1
                `, asaasSubscriptionId);
                
                console.log(`Assinatura ${asaasSubscriptionId} ativada com sucesso!`);
            }
        } else if (event.event === 'PAYMENT_OVERDUE' || event.event === 'PAYMENT_DELETED') {
            if (asaasSubscriptionId) {
                // Se atrasou ou cancelou, bloqueia o acesso
                await prisma.$executeRawUnsafe(`
                    UPDATE empresas SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1
                `, asaasSubscriptionId);

                await prisma.$executeRawUnsafe(`
                    UPDATE designers_financeiro SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1
                `, asaasSubscriptionId);
                
                console.log(`Assinatura ${asaasSubscriptionId} inativada devido a atraso/cancelamento.`);
            }
        }

        return res.status(200).json({ success: true, message: 'Webhook processado' });

    } catch (error) {
        console.error("Erro no Webhook Asaas:", error);
        return res.status(500).json({ message: 'Erro interno ao processar o webhook.' });
    }
};

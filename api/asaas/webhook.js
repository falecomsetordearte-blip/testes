// /api/asaas/webhook.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    console.log(`[WEBHOOK ASAAS] ---> Recebendo requisição <---`);

    if (req.method !== 'POST') {
        console.log(`[WEBHOOK ASAAS] Erro: Método ${req.method} não permitido.`);
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const event = req.body;
        console.log(`[WEBHOOK ASAAS] Evento recebido: ${event.event}`);
        console.log(`[WEBHOOK ASAAS] Dados do Payload:`, JSON.stringify(event));

        if (!event.payment || !event.payment.subscription) {
            console.log(`[WEBHOOK ASAAS] Ignorado: Evento não possui dados de pagamento ou não pertence a uma assinatura recorrente.`);
            return res.status(200).json({ received: true, message: 'Ignorado - Não é assinatura' });
        }

        const subId = event.payment.subscription;
        console.log(`[WEBHOOK ASAAS] ID da Assinatura (Subscription): ${subId}`);

        // Se o pagamento foi confirmado ou recebido
        if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event.event)) {
            console.log(`[WEBHOOK ASAAS] Ação: ATIVAR assinatura ${subId}`);

            // Ativa em ambas as tabelas (o ID é único)
            const resEmpresa = await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, subId);
            const resDesigner = await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, subId);

            console.log(`[WEBHOOK ASAAS] Resultado Update: Empresas afetadas: ${resEmpresa} | Designers afetados: ${resDesigner}`);
        }

        // Se a assinatura foi cancelada ou venceu
        else if (['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'SUBSCRIPTION_DELETED'].includes(event.event)) {
            console.log(`[WEBHOOK ASAAS] Ação: INATIVAR assinatura ${subId}`);

            const resEmpresa = await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1`, subId);
            const resDesigner = await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'INATIVO' WHERE asaas_subscription_id = $1`, subId);

            console.log(`[WEBHOOK ASAAS] Resultado Update: Empresas afetadas: ${resEmpresa} | Designers afetados: ${resDesigner}`);
        } else {
            console.log(`[WEBHOOK ASAAS] Evento ${event.event} mapeado, mas nenhuma ação de alteração de status necessária.`);
        }

        console.log(`[WEBHOOK ASAAS] Processamento concluído com sucesso.`);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("[WEBHOOK ASAAS] ERRO GRAVE:", error.message);
        console.error(error.stack);
        return res.status(500).json({ message: 'Erro interno no webhook.' });
    }
};
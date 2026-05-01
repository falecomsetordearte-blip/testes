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

            // Ativa status em ambas as tabelas
            const resEmpresa = await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, subId);
            const resDesigner = await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'ACTIVE' WHERE asaas_subscription_id = $1`, subId);

            console.log(`[WEBHOOK ASAAS] Resultado Update: Empresas afetadas: ${resEmpresa} | Designers afetados: ${resDesigner}`);

            // VERIFICA O plan_type SALVO NO BANCO (definido em subscribe.js) — NÃO mais pelo valor pago
            if (resEmpresa > 0) {
                const empresaRows = await prisma.$queryRawUnsafe(`SELECT nome_fantasia, plan_type FROM empresas WHERE asaas_subscription_id = $1 LIMIT 1`, subId);
                if (empresaRows.length > 0 && empresaRows[0].plan_type === 'PRO') {
                    console.log(`[WEBHOOK ASAAS] Detectado plan_type PRO. Ativando recursos ChatApp...`);
                    await prisma.$executeRawUnsafe(`UPDATE empresas SET chatapp_plano = 'PREMIUM', chatapp_status = 'AGUARDANDO_ADMIN' WHERE asaas_subscription_id = $1`, subId);
                    await prisma.$executeRawUnsafe(
                        `INSERT INTO notificacoes_globais (titulo, mensagem, tipo, ativa) VALUES ($1, $2, 'warning', true)`,
                        '🚨 NOVO UPGRADE PRO PAGO',
                        `O cliente ${empresaRows[0].nome_fantasia} ativou o plano PRO. Vincule a licença e o link do QR Code no banco para liberar o acesso dele.`
                    );
                }
            }
        }

        else if (['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'SUBSCRIPTION_DELETED'].includes(event.event)) {
            console.log(`[WEBHOOK ASAAS] Ação: INATIVAR assinatura ${subId}`);

            // Verifica se é PRO antes de inativar, para alertar o admin
            const empresasPrem = await prisma.$queryRawUnsafe(`SELECT nome_fantasia, plan_type FROM empresas WHERE asaas_subscription_id = $1 LIMIT 1`, subId);

            // Inativa e reseta plan_type para FREE em ambas as tabelas
            const resEmpresa = await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'INATIVO', plan_type = 'FREE', chatapp_status = 'INATIVO' WHERE asaas_subscription_id = $1`, subId);
            const resDesigner = await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'INATIVO', plan_type = 'FREE' WHERE asaas_subscription_id = $1`, subId);

            if (empresasPrem.length > 0 && empresasPrem[0].plan_type === 'PRO') {
                await prisma.$executeRawUnsafe(`INSERT INTO notificacoes_globais (titulo, mensagem, tipo, ativa) VALUES ($1, $2, 'error', true)`,
                    '🚨 URGENTE: DOWNGRADE/INADIMPLÊNCIA',
                    `O cliente ${empresasPrem[0].nome_fantasia} não renovou o PRO. Vá no ChatApp e cancele a licença associada para evitar cobranças.`
                );
            }

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
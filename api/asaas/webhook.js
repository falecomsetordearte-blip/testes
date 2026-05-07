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

        // ─── BLOCO INDOOR: Pagamento avulso de pedido indoor ─────────────────
        const extRef = event.payment?.externalReference || '';
        if (extRef.startsWith('indoor_') && ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event.event)) {
            const pedidoId = parseInt(extRef.replace('indoor_', ''));
            console.log(`[WEBHOOK ASAAS] [INDOOR] Pagamento confirmado para pedido #${pedidoId}`);

            try {
                const { criarGrupoNotificacoes, definirAvatarGrupo, enviarMensagemTexto } = require('../helpers/chatapp');

                // Buscar pedido + empresa
                const pedidos = await prisma.$queryRawUnsafe(`
                    SELECT p.*, e.nome_fantasia, e.whatsapp AS empresa_wpp, e.logo_id
                    FROM pedidos p
                    LEFT JOIN empresas e ON e.id = p.empresa_id
                    WHERE p.id = $1 AND p.tipo_sistema = 'indoor'
                    LIMIT 1
                `, pedidoId);

                if (pedidos.length === 0) {
                    console.error(`[WEBHOOK ASAAS] [INDOOR] Pedido #${pedidoId} não encontrado.`);
                    return res.status(200).json({ received: true, message: 'Pedido indoor não encontrado.' });
                }

                const p = pedidos[0];

                // Trava de segurança: se já não estiver aguardando, significa que o Asaas está reenviando (Timeout 408)
                if (p.etapa !== 'AGUARDANDO PAGAMENTO') {
                    console.log(`[WEBHOOK ASAAS] [INDOOR] Pedido #${pedidoId} já está na etapa ${p.etapa}. Ignorando reenvio.`);
                    return res.status(200).json({ received: true, message: 'Pedido já processado.' });
                }

                const briefingWpp = p.link_arquivo_impressao || `📋 *BRIEFING — ${p.titulo}*\n\nCliente: ${p.nome_cliente}`;

                console.log(`[WEBHOOK ASAAS] [INDOOR] Criando grupo de notificações para ${p.whatsapp_cliente}...`);

                // Criar grupo WPP
                if (p.whatsapp_cliente) {
                    const grupoNotif = await criarGrupoNotificacoes(
                        p.titulo,
                        p.whatsapp_cliente,
                        p.empresa_wpp,
                        p.nome_cliente || 'Cliente',
                        p.nome_fantasia || 'nossa empresa',
                        true,
                        p.empresa_id
                    );

                    if (grupoNotif && grupoNotif.chatId) {
                        // Salvar grupo e mover para EM EDIÇÃO
                        await prisma.$executeRawUnsafe(`
                            UPDATE pedidos
                            SET chatapp_chat_notificacoes_id = $1, etapa = 'EM EDIÇÃO', updated_at = NOW()
                            WHERE id = $2
                        `, grupoNotif.chatId, pedidoId);

                        console.log(`[WEBHOOK ASAAS] [INDOOR] Grupo criado: ${grupoNotif.chatId} | Pedido movido para EM EDIÇÃO.`);

                        // Definir avatar
                        if (p.logo_id && p.logo_id.startsWith('http')) {
                            await definirAvatarGrupo(grupoNotif.chatId, p.logo_id, true, p.empresa_id);
                        }

                        // Enviar briefing no grupo imediatamente
                        try {
                            await enviarMensagemTexto(grupoNotif.chatId, briefingWpp, true, p.empresa_id);
                            console.log(`[WEBHOOK ASAAS] [INDOOR] Briefing enviado no grupo.`);
                        } catch(e) {
                            console.error(`[WEBHOOK ASAAS] [INDOOR] Erro ao enviar briefing:`, e.message);
                        }

                    } else {
                        // Mesmo sem grupo, move para EM EDIÇÃO
                        await prisma.$executeRawUnsafe(`
                            UPDATE pedidos SET etapa = 'EM EDIÇÃO', updated_at = NOW() WHERE id = $1
                        `, pedidoId);
                        console.warn(`[WEBHOOK ASAAS] [INDOOR] Grupo não criado, mas pedido movido para EM EDIÇÃO.`);
                    }
                } else {
                    // Sem WPP, só move de etapa
                    await prisma.$executeRawUnsafe(`
                        UPDATE pedidos SET etapa = 'EM EDIÇÃO', updated_at = NOW() WHERE id = $1
                    `, pedidoId);
                    console.log(`[WEBHOOK ASAAS] [INDOOR] Sem WhatsApp do cliente. Pedido movido para EM EDIÇÃO.`);
                }

            } catch (errIndoor) {
                console.error(`[WEBHOOK ASAAS] [INDOOR] ERRO ao processar pagamento indoor:`, errIndoor.message);
            }

            return res.status(200).json({ received: true, message: 'Indoor processado.' });
        }
        // ─── FIM BLOCO INDOOR ─────────────────────────────────────────────────

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
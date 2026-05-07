// /api/indoor/mover-etapa.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chatapp = require('../helpers/chatapp');

const PROXIMA_ETAPA = {
    'EM EDIÇÃO': 'VEICULAR',
    'VEICULAR': 'CONCLUÍDO'
};

const MSGS_NOTIF = {
    'VEICULAR': (nome) => `Olá ${nome || ''}! 🎉\n\nSua arte está pronta e aprovada para veicular! Em breve nosso time vai entrar em contato com os próximos passos.`,
    'CONCLUÍDO': (nome) => `Olá ${nome || ''}! ✅\n\nSeu pedido foi concluído com sucesso. Obrigado pela confiança!`
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, id, etapaAtual } = req.body;

        if (!sessionToken || !id || !etapaAtual) {
            return res.status(400).json({ message: 'Dados incompletos' });
        }

        console.log(`[INDOOR-MOVER] Pedido ${id} | Etapa atual: "${etapaAtual}"`);

        const novaEtapa = PROXIMA_ETAPA[etapaAtual];
        if (!novaEtapa) {
            return res.status(400).json({ message: `Etapa "${etapaAtual}" não possui próxima etapa definida.` });
        }

        // Identificar empresa
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const leg = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (leg.length > 0) empresaId = leg[0].id;
        }

        if (!empresaId) return res.status(403).json({ message: 'Sessão inválida' });

        // Atualizar etapa
        const resultado = await prisma.$executeRawUnsafe(`
            UPDATE pedidos
            SET etapa = $1, updated_at = NOW()
            WHERE id = $2 AND empresa_id = $3 AND tipo_sistema = 'indoor'
        `, novaEtapa, parseInt(id), empresaId);

        if (resultado === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou acesso negado.' });
        }

        console.log(`[INDOOR-MOVER] Pedido ${id} movido para "${novaEtapa}".`);

        // Notificar cliente via WhatsApp
        try {
            const pedidos = await prisma.$queryRawUnsafe(`
                SELECT nome_cliente, chatapp_chat_notificacoes_id
                FROM pedidos WHERE id = $1
            `, parseInt(id));

            if (pedidos.length > 0 && pedidos[0].chatapp_chat_notificacoes_id) {
                const p = pedidos[0];
                const msgFn = MSGS_NOTIF[novaEtapa];
                if (msgFn) {
                    const msg = msgFn(p.nome_cliente);
                    await chatapp.enviarMensagemTexto(
                        p.chatapp_chat_notificacoes_id, msg, true, empresaId
                    );
                    console.log(`[INDOOR-MOVER] Notificação WhatsApp enviada.`);
                }
            } else {
                console.log(`[INDOOR-MOVER] Pedido sem grupo de notificações. Pulando envio.`);
            }
        } catch (errNotif) {
            console.error('[INDOOR-MOVER] Erro ao notificar cliente:', errNotif.message);
        }

        return res.status(200).json({ success: true, novaEtapa });

    } catch (error) {
        console.error('[INDOOR-MOVER] Erro:', error);
        return res.status(500).json({ message: 'Erro ao mover etapa.' });
    }
};

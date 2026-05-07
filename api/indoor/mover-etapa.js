// /api/indoor/mover-etapa.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chatapp = require('../helpers/chatapp');

const PROXIMA_ETAPA = {
    'EM EDIÇÃO': 'VEICULAR',
    'VEICULAR': 'VEICULANDO'
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

        // Caso especial: exclusão do card
        if (etapaAtual === '_DELETE_') {
            console.log(`[INDOOR-MOVER] Excluindo pedido ${id}...`);
            let empresaIdDel = null;
            const usersDel = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (usersDel.length > 0) empresaIdDel = usersDel[0].empresa_id;
            else {
                const legDel = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
                if (legDel.length > 0) empresaIdDel = legDel[0].id;
            }
            if (!empresaIdDel) return res.status(403).json({ message: 'Sessão inválida' });
            await prisma.$executeRawUnsafe(`UPDATE pedidos SET etapa = 'CANCELADO', updated_at = NOW() WHERE id = $1 AND empresa_id = $2 AND tipo_sistema = 'indoor'`, parseInt(id), empresaIdDel);
            console.log(`[INDOOR-MOVER] Pedido ${id} marcado como CANCELADO.`);
            return res.status(200).json({ success: true, novaEtapa: 'CANCELADO' });
        }

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
                
                // Buscar configuração da gráfica
                const configs = await prisma.$queryRawUnsafe(`SELECT mensagens_etapas FROM painel_configuracoes_sistema WHERE empresa_id = $1 LIMIT 1`, empresaId);
                
                let template = '';
                if (novaEtapa === 'VEICULAR') {
                    template = "Olá [NOME]! 🎉\n\nSua arte está pronta e aprovada para veicular! Em breve nosso time vai entrar em contato com os próximos passos.";
                } else if (novaEtapa === 'VEICULANDO') {
                    template = "Olá [NOME]! ✅\n\nSeu pedido foi concluído com sucesso. Obrigado pela confiança!";
                }

                if (configs.length > 0 && configs[0].mensagens_etapas) {
                    let msgs = configs[0].mensagens_etapas;
                    if (typeof msgs === 'string') { try { msgs = JSON.parse(msgs); } catch(e) {} }
                    
                    if (novaEtapa === 'VEICULAR' && msgs && msgs.INDOOR_VEICULAR) template = msgs.INDOOR_VEICULAR;
                    if (novaEtapa === 'VEICULANDO' && msgs && msgs.INDOOR_CONCLUIDO) template = msgs.INDOOR_CONCLUIDO;
                }

                if (template) {
                    // Substituir NOME e tratar LINK caso tenha sobrado
                    let msg = template.replace(/\[NOME\]/gi, p.nome_cliente || 'Cliente');
                    msg = msg.replace(/\[LINK\]/gi, ''); // Aqui não tem link nativo do painel editor
                    
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

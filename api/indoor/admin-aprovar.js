// /api/indoor/admin-aprovar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chatapp = require('../helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { pedidoId, linkDownload } = req.body;

        if (!pedidoId || !linkDownload) {
            return res.status(400).json({ message: 'ID do pedido e Link de Download são obrigatórios.' });
        }

        // Buscar pedido e dados da empresa
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, nome_cliente, briefing_completo, chatapp_chat_notificacoes_id, empresa_id
            FROM pedidos WHERE id = $1 AND tipo_sistema = 'indoor'
        `, parseInt(pedidoId));

        if (pedidos.length === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        const p = pedidos[0];

        // Atualizar JSON adicionando o link do arquivo aprovado
        let extras = {};
        try { extras = JSON.parse(p.briefing_completo || '{}'); } catch(e) {}
        extras.linkVideoAprovado = linkDownload;

        // Atualizar banco de dados para a etapa VEICULAR
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos
            SET etapa = 'VEICULAR', briefing_completo = $1, updated_at = NOW()
            WHERE id = $2
        `, JSON.stringify(extras), p.id);

        console.log(`[INDOOR-ADMIN-APROVAR] Pedido #${p.id} aprovado. Link: ${linkDownload}`);

        // Enviar WhatsApp (se houver grupo)
        if (p.chatapp_chat_notificacoes_id) {
            
            // Buscar mensagem customizada da gráfica
            const configs = await prisma.$queryRawUnsafe(`SELECT mensagens_etapas FROM painel_configuracoes_sistema WHERE empresa_id = $1 LIMIT 1`, p.empresa_id);
            let template = "Olá [NOME]! 🎉\n\nSua arte está pronta e aprovada para veicular!\n\n📥 *Baixe o vídeo finalizado aqui:*\n[LINK]";
            
            if (configs.length > 0 && configs[0].mensagens_etapas) {
                let msgs = configs[0].mensagens_etapas;
                if (typeof msgs === 'string') { try { msgs = JSON.parse(msgs); } catch(e) {} }
                if (msgs && msgs.INDOOR_VEICULAR) template = msgs.INDOOR_VEICULAR;
            }

            // Trocar as variáveis mágicas
            let msg = template.replace(/\[NOME\]/gi, p.nome_cliente || 'Cliente');
            msg = msg.replace(/\[LINK\]/gi, linkDownload);
            
            try {
                await chatapp.enviarMensagemTexto(p.chatapp_chat_notificacoes_id, msg, true, p.empresa_id);
                console.log(`[INDOOR-ADMIN-APROVAR] WhatsApp enviado para grupo: ${p.chatapp_chat_notificacoes_id}`);
            } catch(e) {
                console.error(`[INDOOR-ADMIN-APROVAR] Erro ao enviar WhatsApp:`, e.message);
            }
        }

        return res.status(200).json({ success: true, message: 'Pedido aprovado com sucesso!' });

    } catch (error) {
        console.error('[INDOOR-ADMIN-APROVAR] Erro:', error);
        return res.status(500).json({ message: 'Erro ao aprovar pedido.' });
    }
};

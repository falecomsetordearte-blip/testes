// /api/indoor/criar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { criarGrupoNotificacoes, definirAvatarGrupo } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, titulo, nomeCliente, wppCliente, briefing } = req.body;

        console.log(`[INDOOR-CRIAR] Iniciando criação: "${titulo}" | Cliente: ${nomeCliente}`);

        if (!sessionToken || !titulo) {
            return res.status(400).json({ message: 'Título é obrigatório.' });
        }

        // Identificar empresa
        let empresa = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, e.nome_fantasia, e.whatsapp, e.logo_id
            FROM painel_usuarios u
            LEFT JOIN empresas e ON e.id = u.empresa_id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresa = {
                id: users[0].empresa_id,
                nome_fantasia: users[0].nome_fantasia,
                whatsapp: users[0].whatsapp,
                logo_id: users[0].logo_id
            };
        } else {
            const leg = await prisma.$queryRawUnsafe(`
                SELECT id, nome_fantasia, whatsapp, logo_id
                FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (leg.length > 0) empresa = leg[0];
        }

        if (!empresa) return res.status(403).json({ message: 'Sessão inválida' });

        console.log(`[INDOOR-CRIAR] Empresa: ${empresa.nome_fantasia} (ID: ${empresa.id})`);

        // Inserir pedido
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (
                empresa_id, titulo, nome_cliente, whatsapp_cliente,
                briefing_completo, etapa, tipo_sistema, notificar_cliente, created_at, bitrix_deal_id
            )
            VALUES ($1, $2, $3, $4, $5, 'EM EDIÇÃO', 'indoor', true, NOW(), 0)
            RETURNING id
        `,
            empresa.id,
            titulo,
            nomeCliente || 'Sem Nome',
            wppCliente || '',
            briefing || ''
        );

        const newId = insertResult[0].id;
        console.log(`[INDOOR-CRIAR] Pedido criado com ID: ${newId}`);

        // Criar grupo de notificações WhatsApp
        if (wppCliente) {
            console.log(`[INDOOR-CRIAR] Disparando grupo de notificações para ${wppCliente}...`);
            try {
                const grupoNotif = await criarGrupoNotificacoes(
                    titulo,
                    wppCliente,
                    empresa.whatsapp,
                    nomeCliente || 'Cliente',
                    empresa.nome_fantasia || 'nossa gráfica',
                    true,
                    empresa.id
                );

                if (grupoNotif && grupoNotif.chatId) {
                    await prisma.$executeRawUnsafe(`
                        UPDATE pedidos SET chatapp_chat_notificacoes_id = $1 WHERE id = $2
                    `, grupoNotif.chatId, newId);

                    if (empresa.logo_id && empresa.logo_id.startsWith('http')) {
                        await definirAvatarGrupo(grupoNotif.chatId, empresa.logo_id, true, empresa.id);
                    }
                    console.log(`[INDOOR-CRIAR] Grupo vinculado: ${grupoNotif.chatId}`);
                } else {
                    console.warn(`[INDOOR-CRIAR] Grupo não retornou ID.`);
                }
            } catch (e) {
                console.error('[INDOOR-CRIAR] Erro ao criar grupo:', e.message);
            }
        }

        return res.status(200).json({ success: true, dealId: newId });

    } catch (error) {
        console.error('[INDOOR-CRIAR] Erro:', error);
        return res.status(500).json({ message: 'Erro interno ao criar pedido.' });
    }
};

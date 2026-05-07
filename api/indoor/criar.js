// /api/indoor/criar.js — v2: novos campos, sem grupos WPP (diferido para webhook Asaas)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FORMATO_LABEL = { deitado: 'Deitado (16:9)', empo: 'Em Pé (9:16)', quadrado: 'Quadrado (1:1)' };

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const {
            sessionToken, titulo, nomeCliente, wppCliente,
            formato, duracao, valor,
            linkDrive, linkBlob, briefing
        } = req.body;

        console.log(`[INDOOR-CRIAR] Pedido: "${titulo}" | ${nomeCliente} | ${formato} | ${duracao}seg | R$${valor}`);

        if (!sessionToken || !titulo) return res.status(400).json({ message: 'Título é obrigatório.' });
        if (!formato) return res.status(400).json({ message: 'Selecione o formato do vídeo.' });
        if (!duracao || !valor) return res.status(400).json({ message: 'Selecione a duração do vídeo.' });

        // Identificar empresa
        let empresa = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, e.nome_fantasia, e.whatsapp, e.logo_id, e.email
            FROM painel_usuarios u
            LEFT JOIN empresas e ON e.id = u.empresa_id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresa = { id: users[0].empresa_id, nome_fantasia: users[0].nome_fantasia, whatsapp: users[0].whatsapp, logo_id: users[0].logo_id, email: users[0].email };
        } else {
            const leg = await prisma.$queryRawUnsafe(`
                SELECT id, nome_fantasia, whatsapp, logo_id, email FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (leg.length > 0) empresa = leg[0];
        }

        if (!empresa) return res.status(403).json({ message: 'Sessão inválida' });
        console.log(`[INDOOR-CRIAR] Empresa: ${empresa.nome_fantasia} (ID: ${empresa.id})`);

        // Montar briefing_completo como JSON para preservar todos os dados
        const briefingObj = {
            formato,
            duracao,
            valor: parseFloat(valor),
            briefing: briefing || '',
            linkDrive: linkDrive || '',
            linkBlob: linkBlob || ''
        };

        // Montar texto formatado para WhatsApp (será enviado pelo webhook após pagamento)
        const formatoLabel = FORMATO_LABEL[formato] || formato;
        const briefingWpp = [
            `📋 *BRIEFING — ${titulo}*`,
            ``,
            `👤 Cliente: ${nomeCliente || 'Não informado'}`,
            wppCliente ? `📱 WhatsApp: ${wppCliente}` : null,
            ``,
            `🎬 Formato: ${formatoLabel}`,
            `⏱️ Duração: ${duracao} segundos`,
            `💰 Valor: R$ ${parseFloat(valor).toFixed(2)}`,
            briefing ? `\n📝 Briefing:\n${briefing}` : null,
            linkDrive ? `\n🔗 Drive: ${linkDrive}` : null,
            linkBlob ? `\n📎 Arquivo: ${linkBlob}` : null
        ].filter(Boolean).join('\n');

        // Inserir pedido — SEM criar grupos WPP (diferido para webhook Asaas)
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (
                empresa_id, titulo, nome_cliente, whatsapp_cliente,
                briefing_completo, etapa, tipo_sistema, notificar_cliente,
                valor_pago, created_at, bitrix_deal_id
            )
            VALUES ($1, $2, $3, $4, $5, 'AGUARDANDO PAGAMENTO', 'indoor', true, $6, NOW(), 0)
            RETURNING id
        `,
            empresa.id,
            titulo,
            nomeCliente || 'Sem Nome',
            wppCliente || '',
            JSON.stringify(briefingObj),
            parseFloat(valor)
        );

        const newId = insertResult[0].id;
        console.log(`[INDOOR-CRIAR] Pedido criado. ID: ${newId} | Etapa: AGUARDANDO PAGAMENTO`);

        // Salvar briefing WPP formatado para uso posterior no webhook
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos SET link_arquivo_impressao = $1 WHERE id = $2
        `, briefingWpp, newId);

        return res.status(200).json({ success: true, dealId: newId });

    } catch (error) {
        console.error('[INDOOR-CRIAR] Erro:', error);
        return res.status(500).json({ message: 'Erro interno ao criar pedido.' });
    }
};

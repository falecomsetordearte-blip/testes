// /api/indoor/listar-kanban.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(400).json({ message: 'Dados incompletos' });

        console.log(`[INDOOR-KANBAN] Carregando kanban...`);

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

        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, nome_cliente, whatsapp_cliente, briefing_completo,
                   etapa, valor_pago, created_at, asaas_payment_id
            FROM pedidos
            WHERE empresa_id = $1 AND tipo_sistema = 'indoor'
              AND etapa IN ('AGUARDANDO PAGAMENTO', 'EM EDIÇÃO', 'VEICULAR', 'VEICULANDO')
            ORDER BY id DESC
        `, empresaId);

        console.log(`[INDOOR-KANBAN] ${pedidos.length} pedidos encontrados.`);

        const kanban = {
            'AGUARDANDO PAGAMENTO': [],
            'EM EDIÇÃO': [],
            'VEICULAR': [],
            'VEICULANDO': []
        };

        pedidos.forEach(p => {
            let extras = {};
            try { extras = JSON.parse(p.briefing_completo || '{}'); } catch(e) {}

            const col = p.etapa;
            if (!kanban[col]) return;

            kanban[col].push({
                id: p.id,
                titulo: p.titulo,
                nome_cliente: p.nome_cliente,
                whatsapp: p.whatsapp_cliente,
                etapa: p.etapa,
                valor: parseFloat(p.valor_pago || 0),
                formato: extras.formato || '',
                duracao: extras.duracao || '',
                briefing: extras.briefing || '',
                link_drive: extras.linkDrive || '',
                link_blob: extras.linkBlob || '',
                link_video_aprovado: extras.linkVideoAprovado || '',
                asaas_payment_id: p.asaas_payment_id,
                created_at: p.created_at
            });
        });

        return res.status(200).json({ kanban });

    } catch (error) {
        console.error('[INDOOR-KANBAN] Erro:', error);
        return res.status(500).json({ message: 'Erro ao carregar Kanban.' });
    }
};

// /api/indoor/admin-listar-edicao.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // Busca todos os pedidos indoor que estão EM EDIÇÃO (Global, não filtra empresa)
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT p.id, p.titulo, p.nome_cliente, p.whatsapp_cliente, p.briefing_completo,
                   p.etapa, p.created_at, e.nome_fantasia as empresa_nome
            FROM pedidos p
            LEFT JOIN empresas e ON e.id = p.empresa_id
            WHERE p.tipo_sistema = 'indoor' AND p.etapa = 'EM EDIÇÃO'
            ORDER BY p.id ASC
        `);

        const kanban = {
            'EM EDIÇÃO': []
        };

        pedidos.forEach(p => {
            let extras = {};
            try { extras = JSON.parse(p.briefing_completo || '{}'); } catch(e) {}

            kanban['EM EDIÇÃO'].push({
                id: p.id,
                titulo: p.titulo,
                nome_cliente: p.nome_cliente,
                empresa_nome: p.empresa_nome,
                whatsapp: p.whatsapp_cliente,
                etapa: p.etapa,
                formato: extras.formato || '',
                duracao: extras.duracao || '',
                briefing: extras.briefing || '',
                link_drive: extras.linkDrive || '',
                link_blob: extras.linkBlob || '',
                created_at: p.created_at
            });
        });

        return res.status(200).json({ success: true, kanban });
    } catch (error) {
        console.error('[INDOOR-ADMIN-LISTAR] Erro:', error);
        return res.status(500).json({ message: 'Erro ao listar pedidos do editor.' });
    }
};

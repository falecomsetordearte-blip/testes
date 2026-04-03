// /api/instalacao-loja/getDeals.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken } = req.body;

        // 1. Identificar Empresa via Token
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });

        // 2. Buscar Pedidos no Neon
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, etapa, nome_cliente, whatsapp_cliente, 
                   link_arquivo, link_layout, data_entrega, briefing_completo
            FROM pedidos /* cache-bust-inst-loja-v1 */
            WHERE empresa_id = $1 
            AND etapa = 'INSTALAÇÃO NA LOJA'
            ORDER BY id DESC
        `, empresaId);

        // 3. Mapear para chaves do Bitrix (Compatibilidade com painel-script.js)
        const deals = pedidos.map(p => ({
            ID: p.id,
            TITLE: p.titulo || String(p.id),
            STAGE_ID: p.etapa,
            'UF_CRM_1741273407628': p.nome_cliente,
            'UF_CRM_1749481565243': p.whatsapp_cliente,
            'UF_CRM_1748277308731': p.link_arquivo || '', 
            'UF_CRM_1757794109': p.data_entrega,
            'UF_CRM_1764124589418': p.link_layout || '' // Usado como Layout no script
        }));

        return res.status(200).json({ deals });

    } catch (error) {
        console.error('[getDeals Instalação Loja] Erro:', error);
        return res.status(500).json({ message: 'Erro ao carregar pedidos.' });
    }
};
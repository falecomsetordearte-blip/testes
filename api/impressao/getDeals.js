// /api/impressao/getDeals.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;
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

        // Query com campos específicos corrigida para ler link_arquivo_impressao
        let querySql = `
            SELECT id, titulo, etapa, status_impressao, nome_cliente, 
                   whatsapp_cliente, link_arquivo_impressao, data_entrega, briefing_completo
            FROM pedidos /* cache-bust-v4 */
            WHERE empresa_id = $1 
            AND etapa = 'IMPRESSÃO'
        `;
        const queryParams = [empresaId];

        if (impressoraFilter) {
            querySql += ` AND impressora_id = $${queryParams.length + 1}`;
            queryParams.push(impressoraFilter);
        }

        const pedidos = await prisma.$queryRawUnsafe(querySql, ...queryParams);

        const dealsFormatados = pedidos.map(p => ({
            ID: p.id,
            TITLE: p.titulo || String(p.id),
            STAGE_ID: p.etapa,
            'UF_CRM_1757756651931': p.status_impressao || '2659',
            'UF_CRM_1741273407628': p.nome_cliente,
            'UF_CRM_1749481565243': p.whatsapp_cliente,
            'UF_CRM_1748277308731': p.link_arquivo_impressao || '', // Mapeado a coluna correta do BD
            'UF_CRM_1757794109': p.data_entrega,
            'UF_CRM_1738249371': p.briefing_completo
        }));

        return res.status(200).json({ deals: dealsFormatados, localCompanyId: empresaId });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
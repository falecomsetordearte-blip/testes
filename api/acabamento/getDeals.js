// /api/acabamento/getDeals.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;

        // 1. Identificar Empresa via Token
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });
        const empresaId = empresas[0].id;

        // 2. Query SQL com Cache Bust e Filtros
        let querySql = `
            SELECT id, titulo, etapa, nome_cliente, whatsapp_cliente, 
                   data_entrega, briefing_completo, tipo_entrega
            FROM pedidos /* cache-bust-acabamento-v1 */
            WHERE empresa_id = $1 
            AND etapa = 'ACABAMENTO'
        `;
        const queryParams = [empresaId];

        if (impressoraFilter) {
            querySql += ` AND impressora_id = $${queryParams.length + 1}`;
            queryParams.push(impressoraFilter);
        }
        if (materialFilter) {
            querySql += ` AND material_id = $${queryParams.length + 1}`;
            queryParams.push(materialFilter);
        }

        const pedidos = await prisma.$queryRawUnsafe(querySql, ...queryParams);

        // 3. Mapear para chaves do Bitrix (Compatibilidade com acabamento-script.js)
        const deals = pedidos.map(p => ({
            ID: p.id,
            TITLE: p.titulo || String(p.id),
            STAGE_ID: p.etapa,
            'UF_CRM_1741273407628': p.nome_cliente,
            'UF_CRM_1749481565243': p.whatsapp_cliente,
            'UF_CRM_1727464924690': '', // Medidas
            'UF_CRM_1757794109': p.data_entrega, // Prazo Final
            'UF_CRM_1738249371': p.briefing_completo
        }));

        return res.status(200).json({ 
            deals: deals,
            localCompanyId: empresaId 
        });

    } catch (error) {
        console.error('[getDeals Acabamento] Erro:', error);
        return res.status(500).json({ message: 'Erro ao carregar acabamento.' });
    }
};
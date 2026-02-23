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

        // 1. Identificar Empresa
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });
        const empresaId = empresas[0].id;

        // 2. Montar query com filtros opcionais
        let query = `SELECT * FROM pedidos WHERE empresa_id = $1 AND etapa = 'IMPRESSÃO'`;
        const params = [empresaId];

        if (impressoraFilter) {
            query += ` AND impressora_id = $2`;
            params.push(impressoraFilter);
        }
        // Nota: se precisar de mais filtros, adicione $3, $4...

        const pedidos = await prisma.$queryRawUnsafe(query, ...params);

        // 3. Formatar com as chaves do Bitrix para o Frontend
        const deals = pedidos.map(p => ({
            ID: p.id,
            TITLE: p.titulo,
            STAGE_ID: p.etapa,
            'UF_CRM_1757756651931': p.status_impressao || '2659', // Status Interno (Na Fila)
            'UF_CRM_1741273407628': p.nome_cliente,
            'UF_CRM_1749481565243': p.whatsapp_cliente,
            'UF_CRM_1752712769666': '', // Link Atendimento
            'UF_CRM_1727464924690': '', // Medidas
            'UF_CRM_1748277308731': p.link_arquivo || '', 
            'UF_CRM_1757794109': p.data_entrega, // Prazo final
            'UF_CRM_1738249371': p.briefing_completo
        }));

        return res.status(200).json({ 
            deals: deals,
            localCompanyId: empresaId 
        });

    } catch (error) {
        console.error('[getDeals Impressão] Erro:', error);
        return res.status(500).json({ message: 'Erro ao buscar pedidos.' });
    }
};
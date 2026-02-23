// /api/arte/getBoardData.js - VERSÃO COM UNIÃO DE TABELAS
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        const { sessionToken } = req.body;

        if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

        // 1. Identificar Empresa pelo Token
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida' });
        const empresaId = empresas[0].id;

        // 2. BUSCA PODEROSA: Pega o pedido e olha na tabela de cards para saber a coluna interna
        // Fazemos um LEFT JOIN: se não achar na tabela de cards, ele assume 'NOVOS' por padrão
        const pedidosComColuna = await prisma.$queryRawUnsafe(`
            SELECT 
                p.*, 
                COALESCE(c.coluna, 'NOVOS') as coluna_interna
            FROM pedidos p
            LEFT JOIN painel_arte_cards c ON p.id = c.bitrix_deal_id AND p.empresa_id = c.empresa_id
            WHERE p.empresa_id = $1 
            AND p.etapa = 'ARTE'
            ORDER BY p.id DESC
        `, empresaId);

        // 3. Formatar para o Frontend (painel-script.js)
        const processedDeals = pedidosComColuna.map(p => ({
            ID: p.id,
            TITLE: p.titulo || String(p.id),
            STAGE_ID: p.etapa, 
            'UF_CRM_1741273407628': p.nome_cliente,
            'UF_CRM_1749481565243': p.whatsapp_cliente,
            'UF_CRM_1761269158': p.tipo_arte,
            'UF_CRM_1761123161542': p.servico,
            'UF_CRM_1738249371': p.briefing_completo,
            'UF_CRM_1727464924690': '', 
            coluna_local: p.coluna_interna // AGORA SIM: NOVOS, EM_ANDAMENTO, etc.
        }));

        return res.status(200).json({ deals: processedDeals });

    } catch (error) {
        console.error("Erro getBoardData:", error);
        return res.status(500).json({ message: 'Erro interno: ' + error.message });
    }
};
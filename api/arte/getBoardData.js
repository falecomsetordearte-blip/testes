// /api/arte/getBoardData.js
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

        // 1. Identificar Empresa via Token
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida' });
        const empresaId = empresas[0].id;

        // 2. Buscar Pedidos que estão na fase de ARTE ou sub-etapas
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT * FROM pedidos 
            WHERE empresa_id = $1 
            AND etapa IN ('ARTE', 'NOVOS', 'EM_ANDAMENTO', 'AJUSTES', 'AGUARDANDO_CLIENTE')
            ORDER BY id DESC
        `, empresaId);

        // 3. Mapear para o formato que o seu painel-script.js espera (Nomes de campos do Bitrix)
        const processedDeals = pedidos.map(p => ({
            ID: p.id,
            TITLE: p.titulo,
            STAGE_ID: p.etapa, // Manter compatibilidade
            'UF_CRM_1741273407628': p.nome_cliente,
            'UF_CRM_1749481565243': p.whatsapp_cliente,
            'UF_CRM_1761269158': p.tipo_arte,
            'UF_CRM_1761123161542': p.servico,
            'UF_CRM_1738249371': p.briefing_completo,
            'UF_CRM_1727464924690': '', // Medidas (se tiver coluna, adicione aqui)
            coluna_local: p.etapa || 'NOVOS'
        }));

        return res.status(200).json({ deals: processedDeals });

    } catch (error) {
        console.error("Erro getBoardData:", error);
        return res.status(500).json({ message: 'Erro ao buscar dados.' });
    }
};
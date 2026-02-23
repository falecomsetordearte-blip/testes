// /api/arte/moveCard.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, dealId, novaColuna } = req.body;

        // 1. Auth
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });
        const empresaId = empresas[0].id;

        // 2. Atualizar Etapa no Pedido
        // Importante: No seu sistema, a coluna de etapa do Kanban reflete a etapa do pedido
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = $1, updated_at = NOW()
            WHERE id = $2 AND empresa_id = $3
        `, novaColuna, parseInt(dealId), empresaId);

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro moveCard:", error);
        return res.status(500).json({ message: 'Erro ao mover card.' });
    }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, dealId, impressorasIds } = req.body;
        
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Parâmetros ausentes.' });
        }

        let empresaId = null;
        const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length > 0) empresaId = empresas[0].id;
        else {
            const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (users.length > 0) empresaId = users[0].empresa_id;
        }

        if (!empresaId) return res.status(401).json({ message: 'Acesso negado.' });

        const arrayToSave = Array.isArray(impressorasIds) ? impressorasIds : [];

        // Verifica se pedido existe. Se não existir, não podemos salvar na coluna, a não ser que criemos a linha!
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id FROM pedidos WHERE bitrix_deal_id = $1 AND empresa_id = $2 LIMIT 1
        `, parseInt(dealId), empresaId);

        if (pedidos.length === 0) {
            // Se o pedido não existe localmente (pq foi criado só no Bitrix antigamente), vamos inserir uma row ghost
            await prisma.$executeRawUnsafe(`
                INSERT INTO pedidos (empresa_id, bitrix_deal_id, impressoras_ids, titulo)
                VALUES ($1, $2, $3::jsonb, 'Sincronizado do Bitrix')
            `, empresaId, parseInt(dealId), JSON.stringify(arrayToSave));
        } else {
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos SET impressoras_ids = $1::jsonb 
                WHERE bitrix_deal_id = $2 AND empresa_id = $3
            `, JSON.stringify(arrayToSave), parseInt(dealId), empresaId);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro POST savePedidoImpressoras:", error);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

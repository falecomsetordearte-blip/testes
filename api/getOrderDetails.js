// /api/getOrderDetails.js
const prisma = require('../lib/prisma');

module.exports = async (req, res) => {
    // Configuração CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    try {
        const { sessionToken, orderId } = req.body;

        if (!sessionToken || !orderId) {
            return res.status(400).json({ message: 'Token ou ID do pedido ausentes.' });
        }

        // 1. Autenticar Usuário Localmente (Neon)
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

        if (!empresaId) return res.status(403).json({ message: 'Acesso negado. Sessão inválida.' });

        // 2. Buscar Pedido no Banco de Dados (Garante que o pedido pertence a essa empresa)
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT * FROM pedidos 
            WHERE bitrix_deal_id = $1 
            AND empresa_id = $2 
            LIMIT 1
        `, parseInt(orderId), empresaId);

        if (pedidos.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou acesso não autorizado.' });
        }

        const pedidoDB = pedidos[0];

        // 3. Retornar tudo (Status vindo da coluna 'etapa' do banco)
        return res.status(200).json({
            success: true,
            pedido: pedidoDB,
            statusBitrix: pedidoDB.etapa || 'Desconhecido'
        });

    } catch (error) {
        console.error("Erro API getOrderDetails:", error);
        return res.status(500).json({ message: 'Erro interno ao buscar pedido.' });
    }
};
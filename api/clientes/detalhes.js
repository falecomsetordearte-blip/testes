const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, nome } = req.body; 

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

        if (!empresaId) return res.status(403).json({ message: 'Sessão inválida' });

        if (!nome) return res.status(400).json({ message: 'Nome do cliente é obrigatório.' });

        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, etapa, valor_pago, valor_restante, created_at 
            FROM pedidos 
            WHERE empresa_id = $1 AND nome_cliente = $2
            ORDER BY id DESC
        `, empresaId, nome);

        const pedidosFormatados = pedidos.map(p => ({
            ...p,
            id: Number(p.id),
            valor_pago: parseFloat(p.valor_pago || 0),
            valor_restante: parseFloat(p.valor_restante || 0)
        }));

        return res.status(200).json(pedidosFormatados);

    } catch (error) {
        console.error("Erro Detalhes Cliente:", error);
        return res.status(500).json({ message: 'Erro ao carregar detalhes do cliente.' });
    }
};

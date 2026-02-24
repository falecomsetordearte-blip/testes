// /api/designer/getDashboard.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

        // 1. Identificar Designer e Saldo
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome, nivel, saldo_disponivel, saldo_pendente 
            FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designer = designers[0];

        // 2. Buscar Pedidos ATIVOS (Adicionado briefing_completo)
        const meusPedidos = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, nome_cliente, valor_designer, link_acompanhar, etapa, briefing_completo 
            FROM pedidos 
            WHERE designer_id = $1 AND etapa = 'ARTE'
            ORDER BY id DESC
        `, designer.designer_id);

        // 3. Buscar Pedidos DISPONÍVEIS (Mercado)
        let delay = 0;
        if (designer.nivel === 2) delay = 15;
        if (designer.nivel === 3) delay = 30;

        const mercado = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, servico, valor_designer, created_at, briefing_completo
            FROM pedidos 
            WHERE etapa = 'ARTE' AND designer_id IS NULL
            AND created_at <= (NOW() - INTERVAL '${delay} minutes')
            ORDER BY created_at ASC
        `);

        return res.status(200).json({
            designer: {
                nome: designer.nome,
                saldo: parseFloat(designer.saldo_disponivel || 0),
                pendente: parseFloat(designer.saldo_pendente || 0),
                nivel: designer.nivel
            },
            meusPedidos: meusPedidos,
            mercado: mercado
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro ao carregar dashboard do designer.' });
    }
};
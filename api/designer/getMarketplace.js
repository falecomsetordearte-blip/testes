// /api/designer/getMarketplace.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        const { token } = req.body;

        // 1. Identificar o Designer e seu Nível
        const d = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nivel FROM designers_financeiro 
            WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (d.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designer = d[0];

        // 2. Definir "Delay" de visualização por nível (em minutos)
        // Nível 1 (Ouro): 0 min | Nível 2 (Prata): 15 min | Nível 3 (Bronze): 30 min
        let delay = 0;
        if (designer.nivel === 2) delay = 15;
        if (designer.nivel === 3) delay = 30;

        // 3. Buscar pedidos que:
        // - Estão em 'ARTE'
        // - Não têm designer ainda (designer_id IS NULL)
        // - Foram criados há tempo suficiente conforme o nível do designer
        const pedidosDisponiveis = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, servico, valor_designer, created_at, briefing_completo
            FROM pedidos 
            WHERE etapa = 'ARTE' 
            AND designer_id IS NULL
            AND created_at <= (NOW() - INTERVAL '${delay} minutes')
            ORDER BY created_at ASC
        `);

        return res.status(200).json({ 
            nivel: designer.nivel,
            pedidos: pedidosDisponiveis 
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
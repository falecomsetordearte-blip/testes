// /api/designer/getDashboard.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

        // 1. Identificar Designer (Agora puxando também a PONTUAÇÃO)
        // 1. Identificar Designer
        const designers = await prisma.$queryRawUnsafe(`
            SELECT d.designer_id, u.nome, d.assinatura_status, d.pontuacao 
            FROM designers_financeiro d
            JOIN painel_usuarios u ON u.id = d.designer_id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designer = designers[0];

        // 2. Buscar Pedidos ATIVOS (Meus Atendimentos)
        const meusPedidosRaw = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, nome_cliente, valor_designer, link_acompanhar, etapa, briefing_completo 
            FROM pedidos 
            WHERE designer_id = $1 AND etapa = 'ARTE'
            ORDER BY id DESC
        `, designer.designer_id);

        // 3. Buscar Pedidos DISPONÍVEIS (Mercado)
        let delay = 0;
        if (designer.nivel === 2) delay = 15;
        if (designer.nivel === 3) delay = 30;

        const mercadoRaw = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, servico, valor_designer, created_at, briefing_completo
            FROM pedidos 
            WHERE etapa = 'ARTE' AND designer_id IS NULL
            AND created_at <= (NOW() - INTERVAL '${delay} minutes')
            ORDER BY created_at ASC
        `);

        // Faturamento do Mês e Acertos Pendentes
        const financeiros = await prisma.$queryRawUnsafe(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'PAGO' AND EXTRACT(MONTH FROM pago_em) = EXTRACT(MONTH FROM NOW()) THEN valor ELSE 0 END), 0) as faturamento_mes,
                COALESCE(SUM(CASE WHEN status = 'PENDENTE' THEN valor ELSE 0 END), 0) as acertos_pendentes
            FROM acertos_contas
            WHERE designer_id = $1
        `, designer.designer_id);

        // No modelo SaaS, Designer recebe o valor cheio (Sem taxa de 15%)
        const formatarLista = (pedidos) => {
            return pedidos.map(p => ({
                ...p,
                valor_designer: parseFloat(p.valor_designer || 0)
            }));
        };

        return res.status(200).json({
            designer: {
                nome: designer.nome,
                faturamento_mes: parseFloat(financeiros[0].faturamento_mes || 0),
                acertos_pendentes: parseFloat(financeiros[0].acertos_pendentes || 0),
                assinatura_status: designer.assinatura_status || 'INATIVO',
                pontuacao: parseInt(designer.pontuacao || 0)
            },
            meusPedidos: formatarLista(meusPedidosRaw),
            mercado: formatarLista(mercadoRaw)
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro ao carregar dashboard do designer.' });
    }
};
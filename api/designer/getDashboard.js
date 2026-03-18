// /api/designer/getDashboard.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

        // 1. Identificar Designer
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome, nivel, pontuacao 
            FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
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

        // 4. Buscar Acertos de Contas (Ganhos Gerais e Dívidas das Gráficas)
        const acertos = await prisma.$queryRawUnsafe(`
            SELECT a.id, a.valor, a.status, a.criado_em, a.comprovante_url, e.nome_fantasia as grafica_nome 
            FROM acertos_contas a
            JOIN empresas e ON a.empresa_id = e.id
            WHERE a.designer_id = $1
            ORDER BY a.criado_em DESC
        `, designer.designer_id);

        // Calcula Métricas de SaaS Direto
        let saldoPendente = 0; // A receber
        let ganhosMes = 0;     // Total pago neste mês

        const dataAtual = new Date();
        const mesAtual = dataAtual.getMonth();
        const anoAtual = dataAtual.getFullYear();

        acertos.forEach(acerto => {
            const valorFloat = parseFloat(acerto.valor || 0);
            if (acerto.status === 'PENDENTE') {
                saldoPendente += valorFloat;
            } else if (acerto.status === 'PAGO') {
                const dataAcerto = new Date(acerto.criado_em);
                if (dataAcerto.getMonth() === mesAtual && dataAcerto.getFullYear() === anoAtual) {
                    ganhosMes += valorFloat;
                }
            }
        });

        // Retornar os arrays formatando os valores numéricos
        const parseValor = (pedidos) => pedidos.map(p => ({
            ...p,
            valor_designer: parseFloat(p.valor_designer || 0)
        }));

        return res.status(200).json({
            designer: {
                nome: designer.nome,
                ganhosMes: ganhosMes,
                pendente: saldoPendente,
                nivel: designer.nivel,
                pontuacao: parseInt(designer.pontuacao || 0)
            },
            meusPedidos: parseValor(meusPedidosRaw),
            mercado: parseValor(mercadoRaw),
            acertos: acertos.map(a => ({
                id: a.id,
                grafica: a.grafica_nome,
                valor: parseFloat(a.valor || 0),
                status: a.status,
                data: a.criado_em,
                comprovante: a.comprovante_url
            }))
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro ao carregar dashboard do designer.' });
    }
};
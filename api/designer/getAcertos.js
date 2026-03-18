// api/designer/getAcertos.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

    try {
        // 1. Identificar Designer
        let designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) {
            designers = await prisma.$queryRawUnsafe(`
                SELECT d.designer_id FROM designers_financeiro d
                JOIN painel_usuarios u ON u.id = d.designer_id
                WHERE u.session_tokens LIKE $1 LIMIT 1
            `, `%${token}%`);
        }

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        // 2. Buscar Acertos
        const acertos = await prisma.$queryRawUnsafe(`
            SELECT 
                a.*, 
                p.titulo as arte_titulo,
                e.nome_fantasia as empresa_nome
            FROM acertos_contas a
            LEFT JOIN pedidos p ON a.pedido_id = p.id
            LEFT JOIN empresas e ON a.empresa_id = e.id
            WHERE a.designer_id = $1
            ORDER BY a.criado_em DESC
        `, designerId);

        const extratoFormatado = acertos.map(a => ({
            id: a.id,
            data: a.criado_em,
            descricao: a.arte_titulo || 'Pedido #' + a.pedido_id,
            empresa: a.empresa_nome || 'Gráfica #' + a.empresa_id,
            valor: parseFloat(a.valor || 0),
            status: a.status,
            pago_em: a.pago_em,
            comprovante_url: a.comprovante_url
        }));

        return res.status(200).json({ acertos: extratoFormatado });

    } catch (error) {
        console.error("Erro API getAcertos:", error);
        return res.status(500).json({ message: 'Erro interno ao carregar extrato.' });
    }
};

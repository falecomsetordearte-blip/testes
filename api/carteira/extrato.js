// api/carteira/extrato.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { sessionToken, dataInicio, dataFim, statusFilter } = req.body;

    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        // 1. AUTENTICAÇÃO NEON
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        const empresaLocal = empresas[0];

        // 2. Datas
        let start = dataInicio ? new Date(dataInicio) : new Date(new Date().setDate(new Date().getDate() - 30));
        let end = dataFim ? new Date(dataFim) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // 3. Buscar Acertos (SQL)
        // Precisamos do título da arte e chave pix do designer
        const acertos = await prisma.$queryRawUnsafe(`
            SELECT 
                a.*, 
                p.titulo as arte_titulo,
                u.nome as designer_nome,
                df.chave_pix as designer_pix
            FROM acertos_contas a
            JOIN pedidos p ON a.pedido_id = p.id
            JOIN painel_usuarios u ON a.designer_id = u.id
            JOIN designers_financeiro df ON df.designer_id = u.id
            WHERE a.empresa_id = $1
            AND a.criado_em >= $2 AND a.criado_em <= $3
            ORDER BY a.criado_em DESC
        `, empresaLocal.id, start, end);

        const extratoFormatado = acertos.map(a => ({
            id: a.id,
            data: a.criado_em,
            descricao: a.arte_titulo || '-',
            valor: parseFloat(a.valor || 0),
            status: a.status,
            designer: a.designer_nome,
            pix: a.designer_pix,
            pago_em: a.pago_em
        }));

        res.status(200).json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("Erro API Extrato:", error);
        res.status(500).json({ message: 'Erro interno' });
    }
};
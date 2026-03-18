// api/designer/confirmarPagamento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { token, acertoIds, status } = req.body;
    if (!token || !acertoIds || !status) return res.status(400).json({ message: 'Dados incompletos.' });

    try {
        // 1. Identificar Designer
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        const ids = acertoIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

        if (status === 'PAGO') {
            await prisma.$executeRawUnsafe(`
                UPDATE acertos_contas 
                SET status = 'PAGO', pago_em = NOW() 
                WHERE id = ANY($1::int[]) AND designer_id = $2
            `, ids, designerId);
        } else if (status === 'PENDENTE') {
            await prisma.$executeRawUnsafe(`
                UPDATE acertos_contas 
                SET status = 'PENDENTE', comprovante_url = NULL, pago_em = NULL 
                WHERE id = ANY($1::int[]) AND designer_id = $2
            `, ids, designerId);
        }

        return res.status(200).json({ success: true, message: 'Status atualizado com sucesso!' });

    } catch (error) {
        console.error("Erro API confirmarPagamento:", error);
        return res.status(500).json({ message: 'Erro interno ao processar confirmação.' });
    }
};

// /api/designer/confirmarRecebimento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { token, acertoId } = req.body;

        if (!token || !acertoId) {
            return res.status(400).json({ message: 'Token e ID do acerto são obrigatórios.' });
        }

        // 1. Validar Designer pelo Token
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        // 2. Buscar o Acerto
        const acertos = await prisma.$queryRawUnsafe(`
            SELECT id, status, designer_id FROM acertos_contas
            WHERE id = $1
        `, parseInt(acertoId));

        if (acertos.length === 0) {
            return res.status(404).json({ message: 'Acerto não encontrado.' });
        }

        const acerto = acertos[0];

        // Regras de validação
        if (acerto.designer_id !== designerId) {
            return res.status(403).json({ message: 'Você não tem permissão para confirmar este recebimento.' });
        }

        if (acerto.status === 'PAGO') {
            return res.status(400).json({ message: 'Este acerto já foi confirmado.' });
        }

        // 3. Confirmar o Pagamento
        await prisma.$executeRawUnsafe(`
            UPDATE acertos_contas
            SET status = 'PAGO', pago_em = NOW()
            WHERE id = $1
        `, parseInt(acertoId));

        return res.status(200).json({ 
            success: true, 
            message: 'O pagamento foi confirmado com sucesso. Obrigado!' 
        });

    } catch (error) {
        console.error("Erro ao confirmar recebimento:", error);
        return res.status(500).json({ message: 'Erro interno ao processar a confirmação.' });
    }
};

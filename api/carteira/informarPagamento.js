// /api/carteira/informarPagamento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, acertoId, comprovanteUrl } = req.body;

        if (!token || !acertoId) {
            return res.status(400).json({ message: 'Token e ID do acerto são obrigatórios.' });
        }

        // 1. Validar a Empresa
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const empresaId = empresas[0].id;

        // 2. Buscar o Acerto
        const acertos = await prisma.$queryRawUnsafe(`
            SELECT id, status, empresa_id FROM acertos_contas
            WHERE id = $1
        `, parseInt(acertoId));

        if (acertos.length === 0) {
            return res.status(404).json({ message: 'Acerto não encontrado.' });
        }

        const acerto = acertos[0];

        // Regras de validação
        if (acerto.empresa_id !== empresaId) {
            return res.status(403).json({ message: 'Você não tem permissão para alterar este acerto.' });
        }

        if (acerto.status === 'PAGO' || acerto.status === 'PAGO_INFORMADO') {
            return res.status(400).json({ message: 'Este acerto já foi pago ou aguarda confirmação.' });
        }

        // 3. Atualizar Status para PAGO_INFORMADO
        // O Designer terá que confirmar para virar 'PAGO'
        await prisma.$executeRawUnsafe(`
            UPDATE acertos_contas
            SET status = 'PAGO_INFORMADO', comprovante_url = $1
            WHERE id = $2
        `, comprovanteUrl || null, parseInt(acertoId));

        return res.status(200).json({ 
            success: true, 
            message: 'Comprovante recebido. O pagamento aguarda confirmação do designer.' 
        });

    } catch (error) {
        console.error("Erro ao informar pagamento PIX:", error);
        return res.status(500).json({ message: 'Erro interno ao processar a informação.' });
    }
};

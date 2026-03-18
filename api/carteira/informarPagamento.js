// api/carteira/informarPagamento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { sessionToken, acertoId, comprovanteUrl } = req.body;

    if (!sessionToken || !acertoId) {
        return res.status(400).json({ message: 'Dados incompletos.' });
    }

    try {
        // 1. Validar Empresa
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        const empresaId = empresas[0].id;

        // 2. Atualizar o Acerto
        // Mudamos para 'PAGO_INFORMADO' ou 'PAGO' dependendo da sua preferência de verificação
        await prisma.$executeRawUnsafe(`
            UPDATE acertos_contas 
            SET status = 'PAGO', 
                pago_em = NOW(), 
                comprovante_url = $1 
            WHERE id = $2 AND empresa_id = $3
        `, comprovanteUrl, parseInt(acertoId), empresaId);

        return res.status(200).json({ success: true, message: 'Pagamento informado com sucesso!' });

    } catch (error) {
        console.error("Erro ao informar pagamento:", error);
        return res.status(500).json({ message: 'Erro interno ao processar pagamento.' });
    }
};

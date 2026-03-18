// api/carteira/dados.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        // 1. AUTENTICAÇÃO NEON
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        const resultEmpresa = empresas[0];

        // 2. CALCULAR TOTAIS NOVO MODELO (Acertos)
        const totais = await prisma.$queryRawUnsafe(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'PENDENTE' THEN valor ELSE 0 END), 0) as pendente,
                COALESCE(SUM(CASE WHEN status = 'ATRASADO' THEN valor ELSE 0 END), 0) as atrasado,
                COALESCE(SUM(CASE WHEN status = 'PAGO' AND EXTRACT(MONTH FROM pago_em) = EXTRACT(MONTH FROM NOW()) THEN valor ELSE 0 END), 0) as pago_mes
            FROM acertos_contas 
            WHERE empresa_id = $1
        `, resultEmpresa.id);

        res.json({
            saldo_pendente: parseFloat(totais[0].pendente || 0),
            saldo_atrasado: parseFloat(totais[0].atrasado || 0),
            pago_mes: parseFloat(totais[0].pago_mes || 0),
            credito_aprovado: resultEmpresa.credito_aprovado || false,
            assinatura_status: resultEmpresa.assinatura_status || 'INATIVO'
        });

    } catch (error) {
        console.error("Erro Carteira Dados:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
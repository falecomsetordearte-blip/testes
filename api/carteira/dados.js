// api/carteira/dados.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();
    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        const empresas = await prisma.$queryRawUnsafe(`SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const emp = empresas[0];

        console.log(`[CARTEIRA DADOS] Calculando Ledger para empresa ID: ${emp.id}`);

        // 1. Soma de tudo que deve (Artes Pendentes)
        const artes = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor), 0) as total FROM acertos_contas 
            WHERE empresa_id = $1 AND pedido_id IS NOT NULL AND status IN ('PENDENTE', 'LANCADO')
        `, emp.id);

        // 2. Soma de tudo que enviou e tá aguardando designer aprovar
        const emAnalise = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor), 0) as total FROM acertos_contas 
            WHERE empresa_id = $1 AND pedido_id IS NULL AND status = 'AGUARDANDO_CONFIRMACAO'
        `, emp.id);

        // 3. Soma do que foi efetivamente pago este mês
        const pagoMes = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor), 0) as total FROM acertos_contas 
            WHERE empresa_id = $1 AND pedido_id IS NULL AND status = 'PAGO' AND EXTRACT(MONTH FROM pago_em) = EXTRACT(MONTH FROM NOW())
        `, emp.id);

        // O saldo devedor real é o que deve menos o que já mandou o PIX mas o designer ainda não clicou em ok.
        const pendenteBruto = parseFloat(artes[0].total);
        const analise = parseFloat(emAnalise[0].total);
        const devedorReal = pendenteBruto - analise;

        res.json({
            saldo_pendente: devedorReal > 0 ? devedorReal : 0,
            saldo_em_analise: analise,
            pago_mes: parseFloat(pagoMes[0].total),
            credito_aprovado: emp.credito_aprovado || false
        });

    } catch (error) {
        console.error("[ERRO] Carteira Dados:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
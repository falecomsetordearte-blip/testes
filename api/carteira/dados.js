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

        // 2. CALCULAR TOTAIS VIA SQL (Raw Query)
        
        // A) Saldo Em Produção: Soma dos pedidos na etapa 'ARTE'
        const emProducaoResult = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor_designer), 0) as total 
            FROM pedidos 
            WHERE empresa_id = $1 AND etapa = 'ARTE'
        `, resultEmpresa.id);

        // B) Total Faturado/Gasto: Soma dos pedidos na etapa 'IMPRESSÃO'
        const totalGastoResult = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor_designer), 0) as total 
            FROM pedidos 
            WHERE empresa_id = $1 AND etapa = 'IMPRESSÃO'
        `, resultEmpresa.id);

        // Conversão segura de BigInt/Decimal para Float
        const emProducao = parseFloat(emProducaoResult[0]?.total || 0);
        const totalGasto = parseFloat(totalGastoResult[0]?.total || 0);
        const saldoDisponivel = parseFloat(resultEmpresa.saldo || 0);

        res.json({
            saldo_disponivel: saldoDisponivel,
            em_andamento: emProducao,
            a_pagar: totalGasto,
            credito_aprovado: resultEmpresa.credito_aprovado || false,
            solicitacao_pendente: resultEmpresa.solicitacao_credito_pendente || false
        });

    } catch (error) {
        console.error("Erro Carteira Dados:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
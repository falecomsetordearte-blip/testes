// api/carteira/dados.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        // 1. AUTENTICAÇÃO NEON (Adeus Bitrix)
        // Busca empresa que tenha esse token na coluna session_tokens
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida ou expirada.' });
        }
        
        const resultEmpresa = empresas[0];

        // 2. CALCULAR TOTAIS EM TEMPO REAL (Fonte da Verdade: Tabela Pedidos)
        
        // A) Saldo Em Produção: Soma dos pedidos na etapa 'ARTE'
        const emProducaoAgg = await prisma.pedido.aggregate({
            _sum: { valor_designer: true }, 
            where: {
                empresa_id: resultEmpresa.id,
                etapa: 'ARTE'
            }
        });

        // B) Total Faturado/Gasto: Soma dos pedidos na etapa 'IMPRESSÃO'
        const totalGastoAgg = await prisma.pedido.aggregate({
            _sum: { valor_designer: true },
            where: {
                empresa_id: resultEmpresa.id,
                etapa: 'IMPRESSÃO'
            }
        });

        // C) Saldo Disponível (Vem direto da carteira da empresa)
        const saldoDisponivel = parseFloat(resultEmpresa.saldo || 0);

        res.json({
            saldo_disponivel: saldoDisponivel,
            em_andamento: parseFloat(emProducaoAgg._sum.valor_designer || 0),
            a_pagar: parseFloat(totalGastoAgg._sum.valor_designer || 0),
            credito_aprovado: resultEmpresa.credito_aprovado || false,
            solicitacao_pendente: resultEmpresa.solicitacao_credito_pendente || false
        });

    } catch (error) {
        console.error("Erro Carteira Dados:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
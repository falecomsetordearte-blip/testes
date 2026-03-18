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

        // 2. RECUPERAR DADOS DO ACERTO DE CONTAS
        const acertos = await prisma.$queryRawUnsafe(`
            SELECT valor, status, criado_em 
            FROM acertos_contas 
            WHERE empresa_id = $1
        `, resultEmpresa.id);

        let pendenteNoPrazo = 0;
        let atrasado = 0;
        let pagoNoMes = 0;

        const dataAtual = new Date();
        const mesAtual = dataAtual.getMonth();
        const anoAtual = dataAtual.getFullYear();
        
        // Regra de Atraso: 5 dias após a criação do Acerto (entrega da arte)
        const prazoEmDias = 5; 

        acertos.forEach(acerto => {
            const valor = parseFloat(acerto.valor || 0);
            const dataCriacao = new Date(acerto.criado_em);

            if (acerto.status === 'PENDENTE' || acerto.status === 'PAGO_INFORMADO') {
                const diferencaTempo = dataAtual.getTime() - dataCriacao.getTime();
                const diferencaDias = Math.ceil(diferencaTempo / (1000 * 3600 * 24));
                
                if (diferencaDias > prazoEmDias) {
                    atrasado += valor;
                } else {
                    pendenteNoPrazo += valor;
                }
            } else if (acerto.status === 'PAGO') {
                // Soma apenas o que foi pago NO MÊS ATUAL
                if (dataCriacao.getMonth() === mesAtual && dataCriacao.getFullYear() === anoAtual) {
                    pagoNoMes += valor;
                }
            }
        });

        res.json({
            atrasado: atrasado,
            pendente: pendenteNoPrazo,
            pago_mes: pagoNoMes
        });

    } catch (error) {
        console.error("Erro Carteira Dados:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
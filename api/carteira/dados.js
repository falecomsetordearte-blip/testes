// api/carteira/dados.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        // 1. Validar Usuário no Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Buscar dados da Empresa
        const resultEmpresa = await prisma.empresa.findFirst({
            where: { bitrix_company_id: parseInt(bitrixCompanyId) }
        });

        if (!resultEmpresa) return res.status(404).json({ message: 'Empresa não encontrada' });

        // 3. CALCULAR TOTAIS EM TEMPO REAL (Fonte da Verdade: Tabela Pedidos)
        
        // A) Saldo Em Produção: Soma dos pedidos na etapa 'ARTE'
        const emProducaoAgg = await prisma.pedido.aggregate({
            _sum: { valor_designer: true }, // ou valor_cobrado se for diferente
            where: {
                empresa_id: resultEmpresa.id,
                etapa: 'ARTE'
            }
        });

        // B) Total Faturado/Gasto: Soma dos pedidos na etapa 'IMPRESSÃO' (Finalizados)
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
            a_pagar: parseFloat(totalGastoAgg._sum.valor_designer || 0), // Total Faturado
            credito_aprovado: resultEmpresa.credito_aprovado || false,
            solicitacao_pendente: resultEmpresa.solicitacao_credito_pendente || false
        });

    } catch (error) {
        console.error("Erro Carteira Dados:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
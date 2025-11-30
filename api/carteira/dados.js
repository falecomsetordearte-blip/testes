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
        // 1. Identificar usuário no Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Buscar Empresa no Banco usando SQL DIRETO (Resolve o problema do "undefined")
        // COALESCE(coluna, 0) garante que se for NULL, retorne 0
        const resultEmpresa = await prisma.$queryRawUnsafe(
            `SELECT id, 
                    COALESCE(saldo, 0) as saldo, 
                    COALESCE(saldo_devedor, 0) as saldo_devedor, 
                    COALESCE(aprovados, 0) as aprovados,
                    credito_aprovado, 
                    solicitacao_credito_pendente 
             FROM empresas 
             WHERE bitrix_company_id = $1 LIMIT 1`,
            parseInt(bitrixCompanyId)
        );

        if (resultEmpresa.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }

        const empresa = resultEmpresa[0];

        // 3. Buscar Histórico (Mantém Prisma padrão aqui pois tabela historico nao mudou)
        const historico = await prisma.historicoFinanceiro.findMany({
            where: {
                empresa_id: empresa.id,
                data: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
            },
            orderBy: { data: 'desc' }
        });

        // 4. Retornar dados formatados
        res.json({
            saldo_disponivel: parseFloat(empresa.saldo),
            em_andamento: parseFloat(empresa.saldo_devedor),
            a_pagar: parseFloat(empresa.aprovados),
            credito_aprovado: empresa.credito_aprovado || false,
            solicitacao_pendente: empresa.solicitacao_credito_pendente || false,
            historico_recente: historico
        });

    } catch (error) {
        console.error("Erro Carteira Dados:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
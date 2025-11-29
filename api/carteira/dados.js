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
        // 1. Identificar usuário
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        
        // 2. Buscar Empresa e Saldo
        const empresa = await prisma.empresa.findFirst({
            where: { bitrix_company_id: parseInt(bitrixCompanyId) },
            include: {
                historico_financeiro: {
                    where: {
                        data: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } // Pegando últimos 30 dias
                    },
                    orderBy: { data: 'desc' }
                }
            }
        });

        if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada' });

        // 3. Retornar
        res.json({
            saldo_disponivel: parseFloat(empresa.saldo), // <--- NOVO
            em_andamento: parseFloat(empresa.saldo_devedor),
            a_pagar: parseFloat(empresa.aprovados),
            credito_aprovado: empresa.credito_aprovado,
            solicitacao_pendente: empresa.solicitacao_credito_pendente,
            historico_recente: empresa.historico_financeiro
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
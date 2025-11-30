// api/carteira/dados.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Apenas método POST
    if (req.method !== 'POST') return res.status(405).end();

    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    console.log(">>> [CARTEIRA] Iniciando busca de dados...");

    try {
        // 1. Identificar usuário e empresa via Bitrix Token
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID', 'NAME']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            console.log(">>> [CARTEIRA] Token inválido ou usuário não encontrado.");
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const contact = userCheck.data.result[0];
        const bitrixCompanyId = contact.COMPANY_ID;

        console.log(`>>> [CARTEIRA] Usuário: ${contact.NAME} | Bitrix Company ID: ${bitrixCompanyId}`);

        if (!bitrixCompanyId) {
            console.log(">>> [CARTEIRA] Usuário não está vinculado a uma empresa no Bitrix.");
            return res.json({ saldo_disponivel: 0, em_andamento: 0, a_pagar: 0 });
        }
        
        // 2. Buscar Empresa no Neon
        const empresa = await prisma.empresa.findFirst({
            where: { bitrix_company_id: parseInt(bitrixCompanyId) },
            include: {
                historico_financeiro: {
                    where: {
                        data: {
                            gte: new Date(new Date().setDate(new Date().getDate() - 30))
                        }
                    },
                    orderBy: { data: 'desc' }
                }
            }
        });

        if (!empresa) {
            console.log(`>>> [CARTEIRA] Empresa ID ${bitrixCompanyId} não encontrada no banco local.`);
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }

        console.log(`>>> [CARTEIRA] Empresa Local ID: ${empresa.id} | Saldo Bruto (DB):`, empresa.saldo);

        // 3. Conversão Segura de Tipos (Decimal/Null -> Number)
        const saldoFinal = empresa.saldo ? Number(empresa.saldo) : 0.00;
        const devedorFinal = empresa.saldo_devedor ? Number(empresa.saldo_devedor) : 0.00;
        const aprovadosFinal = empresa.aprovados ? Number(empresa.aprovados) : 0.00;

        console.log(`>>> [CARTEIRA] Saldo Final enviado: R$ ${saldoFinal}`);

        // 4. Retornar dados formatados
        res.json({
            saldo_disponivel: saldoFinal,
            em_andamento: devedorFinal,
            a_pagar: aprovadosFinal,
            credito_aprovado: empresa.credito_aprovado || false,
            solicitacao_pendente: empresa.solicitacao_credito_pendente || false,
            historico_recente: empresa.historico_financeiro || []
        });

    } catch (error) {
        console.error(">>> [CARTEIRA ERROR]:", error);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
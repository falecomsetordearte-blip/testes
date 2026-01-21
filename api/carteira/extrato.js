// api/carteira/extrato.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { sessionToken, dataInicio, dataFim } = req.body;
    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        const empresaLocal = await prisma.empresa.findFirst({
            where: { bitrix_company_id: parseInt(bitrixCompanyId) }
        });

        if (!empresaLocal) return res.status(404).json({ message: 'Empresa não encontrada' });

        // Filtro de Data
        let start = dataInicio ? new Date(dataInicio) : new Date(new Date().setDate(new Date().getDate() - 30));
        let end = dataFim ? new Date(dataFim) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const historico = await prisma.historicoFinanceiro.findMany({
            where: {
                empresa_id: empresaLocal.id,
                data: { gte: start, lte: end }
            },
            orderBy: { data: 'desc' }
        });

        // Formatação
        const extratoFormatado = historico.map(item => {
            let link = null;
            
            // Tenta ler o JSON do campo metadados
            if (item.metadados) {
                try {
                    const meta = JSON.parse(item.metadados);
                    link = meta.link_atendimento;
                } catch (e) {
                    // Se falhar o parse, ignora
                }
            }

            // Define se é saída baseado no campo TIPO ou se o valor for negativo (legado)
            const isSaida = item.tipo === 'SAIDA' || item.valor < 0;

            return {
                id: item.id,
                data: item.data,
                titulo: item.titulo,
                descricao: item.descricao || item.titulo,
                valor: parseFloat(item.valor),
                tipo: isSaida ? 'SAIDA' : 'ENTRADA',
                link_atendimento: link
            };
        });

        res.json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("Erro Extrato:", error);
        res.status(500).json({ message: 'Erro interno' });
    }
};
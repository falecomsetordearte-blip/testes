// api/carteira/extrato.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

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

        // Configuração de datas
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

        // Formatação e extração do Link
        const extratoFormatado = historico.map(item => {
            let descricaoLimpa = item.descricao || item.titulo || 'Sem descrição';
            let link = null;
            let tipoCalculado = 'ENTRADA';

            // 1. Extrair Link da string (separador |||)
            if (descricaoLimpa.includes('|||')) {
                const partes = descricaoLimpa.split('|||');
                descricaoLimpa = partes[0].trim();
                link = partes[1] ? partes[1].trim() : null;
            }

            // 2. Determinar Tipo baseado no valor (Negativo = Saída)
            const valorNum = parseFloat(item.valor);
            if (valorNum < 0) {
                tipoCalculado = 'SAIDA';
            }

            return {
                id: item.id,
                data: item.data,
                titulo: item.titulo,
                descricao: descricaoLimpa,
                valor: valorNum,
                tipo: tipoCalculado,
                link_atendimento: link
            };
        });

        res.status(200).json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("Erro API Extrato:", error);
        res.status(500).json({ message: 'Erro interno' });
    }
};
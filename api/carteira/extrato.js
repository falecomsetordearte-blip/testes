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
        // 1. Verificar Sessão no Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Pegar ID da Empresa Local
        const empresaLocal = await prisma.empresa.findFirst({
            where: { bitrix_company_id: parseInt(bitrixCompanyId) }
        });

        if (!empresaLocal) return res.status(404).json({ message: 'Empresa não encontrada' });

        // 3. Configurar datas do filtro
        // Se não vier data, assume últimos 30 dias
        let start = dataInicio ? new Date(dataInicio) : new Date(new Date().setDate(new Date().getDate() - 30));
        let end = dataFim ? new Date(dataFim) : new Date();
        
        // Ajuste de fuso/horário para garantir o dia inteiro
        // Zera o horário do inicio
        start.setHours(0, 0, 0, 0);
        // Seta o final do dia para o fim
        end.setHours(23, 59, 59, 999);

        // 4. Buscar no Banco
        const historico = await prisma.historicoFinanceiro.findMany({
            where: {
                empresa_id: empresaLocal.id,
                data: {
                    gte: start,
                    lte: end
                }
            },
            orderBy: { data: 'desc' }
        });

        // 5. Formatar Resposta (Extraindo Link)
        const extratoFormatado = historico.map(item => {
            let link = null;
            
            // Tenta extrair link do JSON de metadados
            if (item.metadados) {
                try {
                    // Se estiver salvo como string JSON
                    const meta = typeof item.metadados === 'string' ? JSON.parse(item.metadados) : item.metadados;
                    link = meta.link_atendimento || null;
                } catch (e) {
                    // Ignora erro de parse
                }
            }

            return {
                id: item.id,
                data: item.data,
                titulo: item.titulo,
                descricao: item.descricao,
                valor: parseFloat(item.valor),
                tipo: item.tipo, // 'ENTRADA' ou 'SAIDA'
                link_atendimento: link
            };
        });

        res.status(200).json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("Erro API Extrato:", error);
        res.status(500).json({ message: 'Erro interno ao buscar extrato' });
    }
};
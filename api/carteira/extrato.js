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
        // 1. Validar Usuário no Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // 2. Buscar ID Local da Empresa
        const empresaLocal = await prisma.empresa.findFirst({
            where: { bitrix_company_id: parseInt(bitrixCompanyId) }
        });

        if (!empresaLocal) return res.status(404).json({ message: 'Empresa não encontrada' });

        // 3. Configurar Filtro de Datas
        // Se não vier data, pega últimos 30 dias por padrão
        let start = dataInicio ? new Date(dataInicio) : new Date(new Date().setDate(new Date().getDate() - 30));
        let end = dataFim ? new Date(dataFim) : new Date();
        
        // Garante o intervalo completo do dia (00:00 até 23:59)
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // 4. Buscar Histórico no Banco
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

        // 5. Formatar Resposta para o Frontend
        const extratoFormatado = historico.map(item => {
            let link = null;
            let dealId = item.deal_id || null; // Tenta pegar da coluna deal_id se existir no schema antigo

            // Tenta extrair dados do JSON de metadados (onde o webhook novo salva)
            if (item.metadados) {
                try {
                    const meta = typeof item.metadados === 'string' ? JSON.parse(item.metadados) : item.metadados;
                    link = meta.link_atendimento || null;
                    if (!dealId && meta.deal_id) dealId = meta.deal_id;
                } catch (e) {
                    // Ignora erro de parse se for string velha
                }
            }

            // Fallback: Tenta achar ID no título via Regex (para registros antigos)
            // Exemplo de título: "Produção: 3429 (#64449)" -> extrai 64449
            if (!dealId && item.titulo) {
                const match = item.titulo.match(/#(\d+)/);
                if (match) dealId = match[1];
            }

            // Define se é SAIDA (Gasto) ou ENTRADA (Recarga)
            const isSaida = item.tipo === 'SAIDA' || item.valor < 0;

            return {
                id: item.id,
                data: item.data,
                deal_id: dealId || '-', // Garante que nunca vai null para a tabela
                titulo: item.titulo,
                descricao: item.descricao || item.titulo,
                valor: parseFloat(item.valor),
                tipo: isSaida ? 'SAIDA' : 'ENTRADA',
                link_atendimento: link || ''
            };
        });

        res.status(200).json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("Erro API Extrato:", error);
        res.status(500).json({ message: 'Erro interno ao buscar extrato' });
    }
};
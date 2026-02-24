// api/carteira/extrato.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { sessionToken, dataInicio, dataFim, statusFilter } = req.body; // statusFilter: 'TODOS', 'EM_PRODUCAO', 'FINALIZADO'

    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        // 1. Auth
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

        // 2. Datas
        let start = dataInicio ? new Date(dataInicio) : new Date(new Date().setDate(new Date().getDate() - 30));
        let end = dataFim ? new Date(dataFim) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // 3. Buscar Histórico Financeiro
        const historico = await prisma.historicoFinanceiro.findMany({
            where: {
                empresa_id: empresaLocal.id,
                data: { gte: start, lte: end }
            },
            orderBy: { data: 'desc' }
        });

        // 4. Buscar status atual dos pedidos relacionados
        // Extrair IDs de pedidos do histórico para buscar status atual
        const dealIds = historico
            .map(h => parseInt(h.deal_id))
            .filter(id => !isNaN(id));

        const pedidosStatus = await prisma.pedido.findMany({
            where: { id: { in: dealIds } },
            select: { id: true, etapa: true }
        });

        // Mapa rápido para consulta: { 1050: 'ARTE', 1051: 'IMPRESSÃO' }
        const statusMap = {};
        pedidosStatus.forEach(p => statusMap[p.id] = p.etapa);

        // 5. Processar e Filtrar
        let extratoFormatado = historico.map(item => {
            const dealId = parseInt(item.deal_id);
            const etapaAtual = statusMap[dealId] || null;
            
            // Determina status visual
            let statusItem = 'CONCLUIDO'; // Padrão para Entradas/Recargas
            if (item.tipo === 'SAIDA') {
                if (etapaAtual === 'ARTE') statusItem = 'EM_PRODUCAO';
                else if (etapaAtual === 'IMPRESSÃO') statusItem = 'FINALIZADO';
                else statusItem = 'FINALIZADO'; // Assumir finalizado se não achar ou outra etapa
            }

            // Tratamento de metadados antigos
            let link = null;
            if (item.metadados) {
                try {
                    const meta = typeof item.metadados === 'string' ? JSON.parse(item.metadados) : item.metadados;
                    link = meta.link_atendimento;
                } catch(e) {}
            }

            return {
                id: item.id,
                data: item.data,
                deal_id: item.deal_id || '-',
                descricao: item.descricao || item.titulo,
                valor: parseFloat(item.valor),
                tipo: item.tipo, // 'ENTRADA' ou 'SAIDA'
                status: statusItem, // 'EM_PRODUCAO', 'FINALIZADO', 'CONCLUIDO'(entrada)
                link_atendimento: link || ''
            };
        });

        // 6. Aplicar Filtro do Usuário
        if (statusFilter && statusFilter !== 'TODOS') {
            extratoFormatado = extratoFormatado.filter(item => {
                // Se o usuário filtrar por "EM_PRODUCAO", mostra itens com esse status
                // Se filtrar por "FINALIZADO", mostra itens finalizados
                // Entradas de saldo geralmente aparecem em TODOS ou FINALIZADO dependendo da regra, 
                // aqui vamos deixar Entradas visiveis apenas em TODOS ou se criar filtro especifico.
                return item.status === statusFilter; 
            });
        }

        res.status(200).json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("Erro API Extrato:", error);
        res.status(500).json({ message: 'Erro interno' });
    }
};
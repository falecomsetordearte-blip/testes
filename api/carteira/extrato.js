// api/carteira/extrato.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { sessionToken, dataInicio, dataFim, statusFilter } = req.body; 

    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        // 1. AUTENTICAÇÃO NEON
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }
        
        const empresaLocal = empresas[0];

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
        const dealIds = historico
            .map(h => parseInt(h.deal_id))
            .filter(id => !isNaN(id));

        const pedidosStatus = await prisma.pedido.findMany({
            where: { id: { in: dealIds } },
            select: { id: true, etapa: true }
        });

        const statusMap = {};
        pedidosStatus.forEach(p => statusMap[p.id] = p.etapa);

        // 5. Processar e Filtrar
        let extratoFormatado = historico.map(item => {
            const dealId = parseInt(item.deal_id);
            const etapaAtual = statusMap[dealId] || null;
            
            let statusItem = 'CONCLUIDO'; 
            if (item.tipo === 'SAIDA') {
                if (etapaAtual === 'ARTE') statusItem = 'EM_PRODUCAO';
                else if (etapaAtual === 'IMPRESSÃO') statusItem = 'FINALIZADO';
                else statusItem = 'FINALIZADO'; 
            }

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
                tipo: item.tipo, 
                status: statusItem, 
                link_atendimento: link || ''
            };
        });

        // 6. Aplicar Filtro
        if (statusFilter && statusFilter !== 'TODOS') {
            extratoFormatado = extratoFormatado.filter(item => {
                return item.status === statusFilter; 
            });
        }

        res.status(200).json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("Erro API Extrato:", error);
        res.status(500).json({ message: 'Erro interno' });
    }
};
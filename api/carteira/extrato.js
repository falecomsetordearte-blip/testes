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

        // 3. Buscar Acertos de Contas
        let queryParams = [empresaLocal.id, start, end];
        let statusCondition = "";

        if (statusFilter && statusFilter !== 'TODOS') {
            statusCondition = "AND a.status = $4";
            queryParams.push(statusFilter);
        }

        const acertos = await prisma.$queryRawUnsafe(`
            SELECT 
                a.id, 
                a.valor, 
                a.status, 
                a.criado_em as data, 
                p.titulo as pedido_titulo,
                p.id as pedido_id,
                d.nome as designer_nome,
                d.chave_pix as designer_pix,
                a.comprovante_url
            FROM acertos_contas a
            LEFT JOIN pedidos p ON a.pedido_id = p.id
            LEFT JOIN painel_usuarios d ON p.designer_id = d.id -- Ajuste: DesignerName da tabela de usuarios ou pedidos?
            WHERE a.empresa_id = $1 
            AND a.criado_em >= $2 
            AND a.criado_em <= $3 
            ${statusCondition}
            ORDER BY a.criado_em DESC
        `, ...queryParams);

        // Como o relacionamento original de DesignerFinanceiro não tinha 'nome', vamos precisar 
        // garantir que pegamos o nome correto se houver falha no join com painel_usuarios
        // Uma abordagem mais segura aqui é fazer um loop para formatar/garantir dados.
        
        let acertosFormatado = acertos.map(item => {
            return {
                id: item.id,
                data: item.data,
                deal_id: item.pedido_id || '-',
                descricao: item.pedido_titulo || 'Arte Finalizada',
                designer_nome: item.designer_nome || 'Designer Parceiro',
                designer_pix: item.designer_pix || 'Chave não cadastrada',
                valor: parseFloat(item.valor || 0),
                status: item.status, 
                comprovante: item.comprovante_url || ''
            };
        });

        res.status(200).json({ extrato: acertosFormatado });

    } catch (error) {
        console.error("Erro API Extrato:", error);
        res.status(500).json({ message: 'Erro interno' });
    }
};
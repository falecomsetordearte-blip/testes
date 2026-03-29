// api/carteira/extrato.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    const { sessionToken, dataInicio, dataFim } = req.body;

    try {
        let empresas = await prisma.$queryRawUnsafe(`SELECT empresa_id as id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) {
            empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        }
        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const empresaId = empresas[0].id;

        console.log(`[CARTEIRA EXTRATO] Buscando acertos empresa ID: ${empresaId}`);

        const acertos = await prisma.$queryRawUnsafe(`
            SELECT 
                a.*, 
                p.titulo as arte_titulo,
                df.nome as designer_nome_legacy,
                u.nome as designer_nome_novo,
                df.chave_pix as designer_pix
            FROM acertos_contas a
            LEFT JOIN pedidos p ON a.pedido_id = p.id
            LEFT JOIN designers_financeiro df ON a.designer_id = df.designer_id
            LEFT JOIN painel_usuarios u ON a.designer_id = u.id
            WHERE a.empresa_id = $1 
            AND a.status IN ('PENDENTE', 'LANCADO', 'AGUARDANDO_CONFIRMACAO', 'RECUSADO')
            ORDER BY a.criado_em DESC
        `, empresaId);

        const extratoFormatado = acertos.map(a => ({
            id: a.id,
            data: a.criado_em,
            is_pagamento: a.pedido_id === null, // Propriedade nova p/ o frontend saber o que é
            descricao: a.pedido_id === null ? 'Transferência PIX Enviada' : (a.arte_titulo || 'Pedido #' + a.pedido_id),
            valor: parseFloat(a.valor || 0),
            status: a.status,
            designer: a.designer_nome_novo || a.designer_nome_legacy || 'Designer',
            designer_id: a.designer_id,
            pix: a.designer_pix,
            comprovante_url: a.comprovante_url
        }));

        res.status(200).json({ extrato: extratoFormatado });

    } catch (error) {
        console.error("[ERRO] API Extrato:", error);
        res.status(500).json({ message: 'Erro interno' });
    }
};
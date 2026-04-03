const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, dealId, newStageId } = req.body;

        if (!sessionToken || !dealId || !newStageId) {
            return res.status(400).json({ message: 'Parâmetros incompletos.' });
        }

        // 1. Validar Token e Permissão Admin
        const user = await prisma.$queryRawUnsafe(`
            SELECT u.id, f.permissoes, u.empresa_id
            FROM painel_usuarios u
            LEFT JOIN painel_funcoes f ON u.funcao_id = f.id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (user.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida ou não autorizada.' });
        }

        let permissoes = [];
        if (user[0].permissoes) {
             permissoes = typeof user[0].permissoes === 'string' ? JSON.parse(user[0].permissoes) : user[0].permissoes;
        }

        if (!permissoes.includes('admin')) {
             return res.status(403).json({ message: 'Acesso Negado: Apenas administradores podem forçar a alteração de etapa.' });
        }

        const pedidoId = parseInt(dealId, 10);
        if (isNaN(pedidoId)) {
            return res.status(400).json({ message: 'ID do pedido inválido.' });
        }

        // 2. Atualizar Estágio no banco de dados Neon
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = CAST($1 AS VARCHAR) 
            WHERE id = CAST($2 AS INTEGER)
        `, String(newStageId).toUpperCase(), pedidoId);

        res.status(200).json({ success: true, message: 'Etapa do pedido alterada com sucesso.' });

    } catch (error) {
        console.error('Erro ao forçar mudança de etapa no bd local:', error);
        res.status(500).json({ message: 'Erro ao alterar a etapa no servidor.', details: error.message });
    }
};

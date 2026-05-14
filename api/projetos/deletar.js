// /api/projetos/deletar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('[Projetos/Deletar] Módulo carregado.');

module.exports = async (req, res) => {
    console.log('[Projetos/Deletar] Recebida requisição:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    const { sessionToken, projetoId } = req.body;

    if (!sessionToken) {
        console.warn('[Projetos/Deletar] Token de sessão ausente.');
        return res.status(401).json({ message: 'Token de sessão obrigatório.' });
    }

    if (!projetoId) {
        console.warn('[Projetos/Deletar] projetoId ausente.');
        return res.status(400).json({ message: 'projetoId é obrigatório.' });
    }

    try {
        // Valida sessão
        console.log('[Projetos/Deletar] Validando sessão...');
        let empresaId = null;

        const users = await prisma.$queryRawUnsafe(
            `SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`,
            `%${sessionToken}%`
        );
        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const legacy = await prisma.$queryRawUnsafe(
                `SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`,
                `%${sessionToken}%`
            );
            if (legacy.length > 0) empresaId = legacy[0].id;
        }

        if (!empresaId) {
            console.warn('[Projetos/Deletar] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // Verifica se o projeto pertence à empresa
        const projetoExiste = await prisma.$queryRawUnsafe(
            `SELECT id, titulo FROM kanban_projetos WHERE id = $1 AND empresa_id = $2`,
            Number(projetoId), empresaId
        );

        if (!projetoExiste || projetoExiste.length === 0) {
            console.warn(`[Projetos/Deletar] Projeto #${projetoId} não encontrado ou não pertence à empresa.`);
            return res.status(404).json({ message: 'Projeto não encontrado.' });
        }

        const titulo = projetoExiste[0].titulo;
        console.log(`[Projetos/Deletar] Deletando projeto #${projetoId}: "${titulo}"`);

        // Deleta o projeto (tarefas removidas em CASCADE pelo banco)
        await prisma.$queryRawUnsafe(
            `DELETE FROM kanban_projetos WHERE id = $1 AND empresa_id = $2`,
            Number(projetoId), empresaId
        );

        console.log(`[Projetos/Deletar] Projeto #${projetoId} deletado com sucesso.`);
        return res.status(200).json({
            message: 'Projeto deletado com sucesso!',
            projetoId: Number(projetoId),
            titulo
        });
    } catch (error) {
        console.error('[Projetos/Deletar] ERRO ao deletar projeto:', error);
        return res.status(500).json({ message: 'Erro interno ao deletar projeto.', error: error.message });
    } finally {
        await prisma.$disconnect();
    }
};

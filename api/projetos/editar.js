// /api/projetos/editar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('[Projetos/Editar] Módulo carregado.');

module.exports = async (req, res) => {
    console.log('[Projetos/Editar] Recebida requisição:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    const { sessionToken, projetoId, titulo, tarefas } = req.body;

    if (!sessionToken) {
        console.warn('[Projetos/Editar] Token de sessão ausente.');
        return res.status(401).json({ message: 'Token de sessão obrigatório.' });
    }

    if (!projetoId) {
        console.warn('[Projetos/Editar] projetoId ausente.');
        return res.status(400).json({ message: 'projetoId é obrigatório.' });
    }

    if (!titulo || !titulo.trim()) {
        console.warn('[Projetos/Editar] Título ausente ou vazio.');
        return res.status(400).json({ message: 'O título do projeto é obrigatório.' });
    }

    if (!tarefas || !Array.isArray(tarefas) || tarefas.length === 0) {
        console.warn('[Projetos/Editar] Nenhuma tarefa informada.');
        return res.status(400).json({ message: 'Adicione ao menos uma tarefa ao projeto.' });
    }

    try {
        // Valida sessão
        console.log('[Projetos/Editar] Validando sessão...');
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
            console.warn('[Projetos/Editar] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // Verifica se o projeto pertence à empresa
        const projetoExiste = await prisma.$queryRawUnsafe(
            `SELECT id, titulo FROM kanban_projetos WHERE id = $1 AND empresa_id = $2`,
            Number(projetoId), empresaId
        );

        if (!projetoExiste || projetoExiste.length === 0) {
            console.warn(`[Projetos/Editar] Projeto #${projetoId} não encontrado.`);
            return res.status(404).json({ message: 'Projeto não encontrado.' });
        }

        const tarefasTexto = tarefas
            .map(t => (typeof t === 'string' ? t.trim() : t.texto?.trim()))
            .filter(t => t && t.length > 0);

        console.log(`[Projetos/Editar] Atualizando projeto #${projetoId}: "${titulo}" com ${tarefasTexto.length} tarefa(s).`);

        // Atualiza título
        await prisma.$queryRawUnsafe(
            `UPDATE kanban_projetos SET titulo = $1, atualizado_em = NOW() WHERE id = $2 AND empresa_id = $3`,
            titulo.trim(), Number(projetoId), empresaId
        );

        // Deleta tarefas antigas e recria (estratégia mais simples e segura)
        await prisma.$queryRawUnsafe(
            `DELETE FROM kanban_tarefas WHERE projeto_id = $1`,
            Number(projetoId)
        );
        console.log(`[Projetos/Editar] Tarefas antigas do projeto #${projetoId} removidas.`);

        for (let i = 0; i < tarefasTexto.length; i++) {
            await prisma.$queryRawUnsafe(
                `INSERT INTO kanban_tarefas (projeto_id, texto, ordem) VALUES ($1, $2, $3)`,
                Number(projetoId), tarefasTexto[i], i
            );
        }
        console.log(`[Projetos/Editar] ${tarefasTexto.length} tarefa(s) recriadas para o projeto #${projetoId}.`);

        // Retorna projeto completo atualizado
        const projetoAtualizado = await prisma.$queryRawUnsafe(`
            SELECT
                p.id, p.titulo, p.coluna, p.ordem, p.criado_em, p.atualizado_em,
                COALESCE(
                    json_agg(
                        json_build_object('id', pt.id, 'texto', pt.texto, 'concluida', pt.concluida, 'ordem', pt.ordem)
                        ORDER BY pt.ordem ASC
                    ) FILTER (WHERE pt.id IS NOT NULL),
                    '[]'
                ) AS tarefas
            FROM kanban_projetos p
            LEFT JOIN kanban_tarefas pt ON pt.projeto_id = p.id
            WHERE p.id = $1
            GROUP BY p.id
        `, Number(projetoId));

        return res.status(200).json({
            message: 'Projeto atualizado com sucesso!',
            projeto: projetoAtualizado[0]
        });
    } catch (error) {
        console.error('[Projetos/Editar] ERRO ao editar projeto:', error);
        return res.status(500).json({ message: 'Erro interno ao editar projeto.', error: error.message });
    } finally {
        await prisma.$disconnect();
    }
};

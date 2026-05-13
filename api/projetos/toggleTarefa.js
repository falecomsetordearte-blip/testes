// /api/projetos/toggleTarefa.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('[Projetos/ToggleTarefa] Módulo carregado.');

module.exports = async (req, res) => {
    console.log('[Projetos/ToggleTarefa] Recebida requisição:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    const { sessionToken, tarefaId, concluida } = req.body;

    if (!sessionToken) {
        console.warn('[Projetos/ToggleTarefa] Token de sessão ausente.');
        return res.status(401).json({ message: 'Token de sessão obrigatório.' });
    }

    if (tarefaId === undefined || tarefaId === null) {
        console.warn('[Projetos/ToggleTarefa] tarefaId ausente.');
        return res.status(400).json({ message: 'tarefaId é obrigatório.' });
    }

    if (concluida === undefined || concluida === null) {
        console.warn('[Projetos/ToggleTarefa] Campo "concluida" ausente.');
        return res.status(400).json({ message: 'Campo "concluida" (boolean) é obrigatório.' });
    }

    try {
        // Valida sessão
        console.log('[Projetos/ToggleTarefa] Validando sessão...');
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
            console.warn('[Projetos/ToggleTarefa] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // Verifica se a tarefa pertence a um projeto da empresa
        const tarefaExiste = await prisma.$queryRawUnsafe(`
            SELECT pt.id, pt.projeto_id, pt.concluida
            FROM kanban_tarefas pt
            INNER JOIN kanban_projetos p ON p.id = pt.projeto_id
            WHERE pt.id = $1 AND p.empresa_id = $2
        `, Number(tarefaId), empresaId);

        if (!tarefaExiste || tarefaExiste.length === 0) {
            console.warn(`[Projetos/ToggleTarefa] Tarefa #${tarefaId} não encontrada.`);
            return res.status(404).json({ message: 'Tarefa não encontrada.' });
        }

        const novoConcluida = Boolean(concluida);
        console.log(`[Projetos/ToggleTarefa] Tarefa #${tarefaId} → concluida: ${novoConcluida}`);

        // Atualiza a tarefa
        await prisma.$queryRawUnsafe(
            `UPDATE kanban_tarefas SET concluida = $1 WHERE id = $2`,
            novoConcluida, Number(tarefaId)
        );

        // Retorna progresso atualizado do projeto
        const progresso = await prisma.$queryRawUnsafe(`
            SELECT 
                COUNT(*) AS total,
                COUNT(CASE WHEN concluida = true THEN 1 END) AS concluidas
            FROM kanban_tarefas
            WHERE projeto_id = $1
        `, tarefaExiste[0].projeto_id);

        const total = Number(progresso[0]?.total || 0);
        const concluidas_count = Number(progresso[0]?.concluidas || 0);
        const percentual = total > 0 ? Math.round((concluidas_count / total) * 100) : 0;

        console.log(`[Projetos/ToggleTarefa] Progresso do projeto #${tarefaExiste[0].projeto_id}: ${concluidas_count}/${total} (${percentual}%)`);

        return res.status(200).json({ 
            message: 'Tarefa atualizada com sucesso!',
            tarefaId: Number(tarefaId),
            concluida: novoConcluida,
            progresso: { total, concluidas: concluidas_count, percentual }
        });
    } catch (error) {
        console.error('[Projetos/ToggleTarefa] ERRO ao atualizar tarefa:', error);
        return res.status(500).json({ message: 'Erro interno ao atualizar tarefa.', error: error.message });
    } finally {
        await prisma.$disconnect();
    }
};

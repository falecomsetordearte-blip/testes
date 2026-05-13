// /api/projetos/toggleTarefa.js
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig, Pool } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

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

    const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
    const adapter = new PrismaNeon(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        // Valida sessão e obtém empresa
        console.log('[Projetos/ToggleTarefa] Validando sessão...');
        const empresa = await prisma.empresa.findFirst({
            where: { session_tokens: { contains: sessionToken } },
            select: { id: true }
        });

        if (!empresa) {
            console.warn('[Projetos/ToggleTarefa] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // Verifica se a tarefa existe e pertence a um projeto da empresa
        const tarefaExiste = await prisma.$queryRaw`
            SELECT pt.id, pt.projeto_id, pt.texto, pt.concluida
            FROM kanban_tarefas pt
            INNER JOIN kanban_projetos p ON p.id = pt.projeto_id
            WHERE pt.id = ${Number(tarefaId)} AND p.empresa_id = ${empresa.id}
        `;

        if (!tarefaExiste || tarefaExiste.length === 0) {
            console.warn(`[Projetos/ToggleTarefa] Tarefa #${tarefaId} não encontrada ou não pertence à empresa.`);
            return res.status(404).json({ message: 'Tarefa não encontrada.' });
        }

        const novoConcluida = Boolean(concluida);
        console.log(`[Projetos/ToggleTarefa] Tarefa #${tarefaId} → concluida: ${novoConcluida}`);

        // Atualiza o status da tarefa
        await prisma.$queryRaw`
            UPDATE kanban_tarefas
            SET concluida = ${novoConcluida}
            WHERE id = ${Number(tarefaId)}
        `;

        // Retorna o progresso atualizado do projeto
        const progresso = await prisma.$queryRaw`
            SELECT 
                COUNT(*) AS total,
                COUNT(CASE WHEN concluida = true THEN 1 END) AS concluidas
            FROM kanban_tarefas
            WHERE projeto_id = ${tarefaExiste[0].projeto_id}
        `;

        const total = Number(progresso[0]?.total || 0);
        const concluidas = Number(progresso[0]?.concluidas || 0);
        const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        console.log(`[Projetos/ToggleTarefa] Progresso do projeto #${tarefaExiste[0].projeto_id}: ${concluidas}/${total} (${percentual}%)`);

        return res.status(200).json({ 
            message: 'Tarefa atualizada com sucesso!',
            tarefaId: Number(tarefaId),
            concluida: novoConcluida,
            progresso: { total, concluidas, percentual }
        });
    } catch (error) {
        console.error('[Projetos/ToggleTarefa] ERRO ao atualizar tarefa:', error);
        return res.status(500).json({ message: 'Erro interno ao atualizar tarefa.', error: error.message });
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
};

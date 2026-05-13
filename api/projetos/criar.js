// /api/projetos/criar.js
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig, Pool } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

console.log('[Projetos/Criar] Módulo carregado.');

module.exports = async (req, res) => {
    console.log('[Projetos/Criar] Recebida requisição:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    const { sessionToken, titulo, tarefas, coluna } = req.body;

    if (!sessionToken) {
        console.warn('[Projetos/Criar] Token de sessão ausente.');
        return res.status(401).json({ message: 'Token de sessão obrigatório.' });
    }

    if (!titulo || !titulo.trim()) {
        console.warn('[Projetos/Criar] Título ausente ou vazio.');
        return res.status(400).json({ message: 'O título do projeto é obrigatório.' });
    }

    if (!tarefas || !Array.isArray(tarefas) || tarefas.length === 0) {
        console.warn('[Projetos/Criar] Nenhuma tarefa informada.');
        return res.status(400).json({ message: 'Adicione ao menos uma tarefa ao projeto.' });
    }

    const colunaValida = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
    const colunaFinal = colunaValida.includes(coluna) ? coluna : 'SEGUNDA';

    const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
    const adapter = new PrismaNeon(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        // Valida sessão e obtém empresa
        console.log('[Projetos/Criar] Validando sessão...');
        const empresa = await prisma.empresa.findFirst({
            where: { session_tokens: { contains: sessionToken } },
            select: { id: true, nome_fantasia: true }
        });

        if (!empresa) {
            console.warn('[Projetos/Criar] Sessão inválida ou empresa não encontrada.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        console.log(`[Projetos/Criar] Empresa autenticada: ID ${empresa.id} - ${empresa.nome_fantasia}`);
        console.log(`[Projetos/Criar] Criando projeto: "${titulo}" com ${tarefas.length} tarefa(s) na coluna ${colunaFinal}`);

        // Cria o projeto e as tarefas em transação
        const novoProjeto = await prisma.$transaction(async (tx) => {
            // Determina a ordem (último + 1)
            const ultimoOrdem = await tx.$queryRaw`
                SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem
                FROM kanban_projetos
                WHERE empresa_id = ${empresa.id} AND coluna = ${colunaFinal}
            `;
            const ordem = Number(ultimoOrdem[0]?.proxima_ordem || 1);

            // Cria o projeto
            const projeto = await tx.$queryRaw`
                INSERT INTO kanban_projetos (empresa_id, titulo, coluna, ordem)
                VALUES (${empresa.id}, ${titulo.trim()}, ${colunaFinal}, ${ordem})
                RETURNING id, titulo, coluna, ordem, criado_em
            `;
            const projetoCriado = projeto[0];

            // Cria as tarefas vinculadas
            const tarefasTexto = tarefas
                .map(t => (typeof t === 'string' ? t.trim() : t.texto?.trim()))
                .filter(t => t && t.length > 0);

            for (let i = 0; i < tarefasTexto.length; i++) {
                await tx.$queryRaw`
                    INSERT INTO kanban_tarefas (projeto_id, texto, ordem)
                    VALUES (${projetoCriado.id}, ${tarefasTexto[i]}, ${i})
                `;
            }

            console.log(`[Projetos/Criar] Projeto #${projetoCriado.id} criado com ${tarefasTexto.length} tarefa(s).`);
            return projetoCriado;
        });

        // Retorna projeto completo com tarefas
        const projetoCompleto = await prisma.$queryRaw`
            SELECT 
                p.id, p.titulo, p.coluna, p.ordem, p.criado_em,
                COALESCE(
                    json_agg(
                        json_build_object('id', pt.id, 'texto', pt.texto, 'concluida', pt.concluida, 'ordem', pt.ordem)
                        ORDER BY pt.ordem ASC
                    ) FILTER (WHERE pt.id IS NOT NULL),
                    '[]'
                ) AS tarefas
            FROM kanban_projetos p
            LEFT JOIN kanban_tarefas pt ON pt.projeto_id = p.id
            WHERE p.id = ${novoProjeto.id}
            GROUP BY p.id
        `;

        return res.status(201).json({ 
            message: 'Projeto criado com sucesso!', 
            projeto: projetoCompleto[0] 
        });
    } catch (error) {
        console.error('[Projetos/Criar] ERRO ao criar projeto:', error);
        return res.status(500).json({ message: 'Erro interno ao criar projeto.', error: error.message });
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
};

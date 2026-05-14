// /api/projetos/criar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('[Projetos/Criar] Módulo carregado.');

module.exports = async (req, res) => {
    console.log('[Projetos/Criar] Recebida requisição:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    const { sessionToken, titulo, tarefas, coluna, dataInstalacao } = req.body;

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

    const colunaValida = ['PRODUCAO', 'AGENDAR', 'INSTALAR'];
    const colunaFinal = colunaValida.includes(coluna) ? coluna : 'PRODUCAO';

    try {
        // Valida sessão
        console.log('[Projetos/Criar] Validando sessão...');
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
            console.warn('[Projetos/Criar] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        console.log(`[Projetos/Criar] Empresa ID ${empresaId}. Criando projeto: "${titulo}" na coluna ${colunaFinal} | Data instalação: ${dataInstalacao || 'não informada'}`);

        // Calcula próxima ordem nessa coluna
        const ordemResult = await prisma.$queryRawUnsafe(
            `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM kanban_projetos WHERE empresa_id = $1 AND coluna = $2`,
            empresaId, colunaFinal
        );
        const ordem = Number(ordemResult[0]?.proxima_ordem || 1);

        // Cria o projeto
        const dataInstalacaoFinal = dataInstalacao || null;
        const projetoResult = await prisma.$queryRawUnsafe(
            `INSERT INTO kanban_projetos (empresa_id, titulo, coluna, ordem, data_instalacao) VALUES ($1, $2, $3, $4, $5::date) RETURNING id, titulo, coluna, ordem, criado_em, data_instalacao`,
            empresaId, titulo.trim(), colunaFinal, ordem, dataInstalacaoFinal
        );
        const projetoCriado = projetoResult[0];
        console.log(`[Projetos/Criar] Projeto #${projetoCriado.id} criado.`);

        // Cria as tarefas
        const tarefasTexto = tarefas
            .map(t => (typeof t === 'string' ? t.trim() : t.texto?.trim()))
            .filter(t => t && t.length > 0);

        for (let i = 0; i < tarefasTexto.length; i++) {
            await prisma.$queryRawUnsafe(
                `INSERT INTO kanban_tarefas (projeto_id, texto, ordem) VALUES ($1, $2, $3)`,
                projetoCriado.id, tarefasTexto[i], i
            );
        }
        console.log(`[Projetos/Criar] ${tarefasTexto.length} tarefa(s) criadas para o projeto #${projetoCriado.id}.`);

        // Retorna projeto completo com tarefas
        const projetoCompleto = await prisma.$queryRawUnsafe(`
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
            WHERE p.id = $1
            GROUP BY p.id
        `, projetoCriado.id);

        return res.status(201).json({ 
            message: 'Projeto criado com sucesso!', 
            projeto: projetoCompleto[0] 
        });
    } catch (error) {
        console.error('[Projetos/Criar] ERRO ao criar projeto:', error);
        return res.status(500).json({ message: 'Erro interno ao criar projeto.', error: error.message });
    } finally {
        await prisma.$disconnect();
    }
};

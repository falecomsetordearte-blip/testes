// /api/projetos/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('[Projetos/Listar] Módulo carregado.');

module.exports = async (req, res) => {
    console.log('[Projetos/Listar] Recebida requisição:', req.method);

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    const sessionToken = req.headers['authorization'] || req.query.token;

    if (!sessionToken) {
        console.warn('[Projetos/Listar] Token de sessão ausente.');
        return res.status(401).json({ message: 'Token de sessão obrigatório.' });
    }

    try {
        // Valida sessão — tenta painel_usuarios primeiro, depois empresas (legacy)
        console.log('[Projetos/Listar] Validando sessão...');
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
            console.warn('[Projetos/Listar] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        console.log(`[Projetos/Listar] Empresa autenticada: ID ${empresaId}`);

        // Busca todos os projetos com suas tarefas
        const projetos = await prisma.$queryRawUnsafe(`
            SELECT 
                p.id,
                p.titulo,
                p.coluna,
                p.ordem,
                p.data_instalacao,
                p.criado_em,
                p.atualizado_em,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pt.id,
                            'texto', pt.texto,
                            'concluida', pt.concluida,
                            'ordem', pt.ordem
                        ) ORDER BY pt.ordem ASC, pt.id ASC
                    ) FILTER (WHERE pt.id IS NOT NULL),
                    '[]'
                ) AS tarefas
            FROM kanban_projetos p
            LEFT JOIN kanban_tarefas pt ON pt.projeto_id = p.id
            WHERE p.empresa_id = $1
            GROUP BY p.id
            ORDER BY p.coluna ASC, p.ordem ASC, p.id ASC
        `, empresaId);

        console.log(`[Projetos/Listar] Total de projetos encontrados: ${projetos.length}`);

        return res.status(200).json({ projetos });
    } catch (error) {
        console.error('[Projetos/Listar] ERRO ao listar projetos:', error);
        return res.status(500).json({ message: 'Erro interno ao listar projetos.', error: error.message });
    } finally {
        await prisma.$disconnect();
    }
};

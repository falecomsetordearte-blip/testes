// /api/projetos/listar.js
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig, Pool } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

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

    const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
    const adapter = new PrismaNeon(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        // Valida sessão e obtém empresa
        console.log('[Projetos/Listar] Validando sessão...');
        const empresa = await prisma.empresa.findFirst({
            where: { session_tokens: { contains: sessionToken } },
            select: { id: true, nome_fantasia: true }
        });

        if (!empresa) {
            console.warn('[Projetos/Listar] Sessão inválida ou empresa não encontrada.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        console.log(`[Projetos/Listar] Empresa autenticada: ID ${empresa.id} - ${empresa.nome_fantasia}`);

        // Busca todos os projetos com suas tarefas
        const projetos = await prisma.$queryRaw`
            SELECT 
                p.id,
                p.titulo,
                p.coluna,
                p.ordem,
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
            WHERE p.empresa_id = ${empresa.id}
            GROUP BY p.id
            ORDER BY p.coluna ASC, p.ordem ASC, p.id ASC
        `;

        console.log(`[Projetos/Listar] Total de projetos encontrados: ${projetos.length}`);

        return res.status(200).json({ projetos });
    } catch (error) {
        console.error('[Projetos/Listar] ERRO ao listar projetos:', error);
        return res.status(500).json({ message: 'Erro interno ao listar projetos.', error: error.message });
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
};

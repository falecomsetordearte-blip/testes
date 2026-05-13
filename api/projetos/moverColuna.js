// /api/projetos/moverColuna.js
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig, Pool } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

console.log('[Projetos/MoverColuna] Módulo carregado.');

module.exports = async (req, res) => {
    console.log('[Projetos/MoverColuna] Recebida requisição:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    const { sessionToken, projetoId, novaColuna } = req.body;

    if (!sessionToken) {
        console.warn('[Projetos/MoverColuna] Token de sessão ausente.');
        return res.status(401).json({ message: 'Token de sessão obrigatório.' });
    }

    if (!projetoId || !novaColuna) {
        console.warn('[Projetos/MoverColuna] projetoId ou novaColuna ausentes.');
        return res.status(400).json({ message: 'projetoId e novaColuna são obrigatórios.' });
    }

    const colunaValida = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'];
    if (!colunaValida.includes(novaColuna)) {
        console.warn(`[Projetos/MoverColuna] Coluna inválida: ${novaColuna}`);
        return res.status(400).json({ message: `Coluna inválida. Use: ${colunaValida.join(', ')}` });
    }

    const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
    const adapter = new PrismaNeon(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        // Valida sessão e obtém empresa
        console.log('[Projetos/MoverColuna] Validando sessão...');
        const empresa = await prisma.empresa.findFirst({
            where: { session_tokens: { contains: sessionToken } },
            select: { id: true }
        });

        if (!empresa) {
            console.warn('[Projetos/MoverColuna] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // Verifica se o projeto pertence à empresa
        const projetoExiste = await prisma.$queryRaw`
            SELECT id, titulo, coluna FROM projetos
            WHERE id = ${Number(projetoId)} AND empresa_id = ${empresa.id}
        `;

        if (!projetoExiste || projetoExiste.length === 0) {
            console.warn(`[Projetos/MoverColuna] Projeto #${projetoId} não encontrado ou não pertence à empresa.`);
            return res.status(404).json({ message: 'Projeto não encontrado.' });
        }

        const colunaAnterior = projetoExiste[0].coluna;
        console.log(`[Projetos/MoverColuna] Movendo projeto #${projetoId} de "${colunaAnterior}" → "${novaColuna}"`);

        // Calcula nova ordem (final da coluna de destino)
        const ultimaOrdem = await prisma.$queryRaw`
            SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem
            FROM projetos
            WHERE empresa_id = ${empresa.id} AND coluna = ${novaColuna} AND id != ${Number(projetoId)}
        `;
        const novaOrdem = Number(ultimaOrdem[0]?.proxima_ordem || 1);

        // Atualiza a coluna e a ordem
        await prisma.$queryRaw`
            UPDATE projetos
            SET coluna = ${novaColuna}, ordem = ${novaOrdem}, atualizado_em = NOW()
            WHERE id = ${Number(projetoId)} AND empresa_id = ${empresa.id}
        `;

        console.log(`[Projetos/MoverColuna] Projeto #${projetoId} movido com sucesso para "${novaColuna}".`);
        return res.status(200).json({ 
            message: 'Projeto movido com sucesso!',
            projetoId: Number(projetoId),
            colunaAnterior,
            novaColuna
        });
    } catch (error) {
        console.error('[Projetos/MoverColuna] ERRO ao mover projeto:', error);
        return res.status(500).json({ message: 'Erro interno ao mover projeto.', error: error.message });
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
};

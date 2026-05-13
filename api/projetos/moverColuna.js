// /api/projetos/moverColuna.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

    try {
        // Valida sessão
        console.log('[Projetos/MoverColuna] Validando sessão...');
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
            console.warn('[Projetos/MoverColuna] Sessão inválida.');
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // Verifica se o projeto pertence à empresa
        const projetoExiste = await prisma.$queryRawUnsafe(
            `SELECT id, titulo, coluna FROM kanban_projetos WHERE id = $1 AND empresa_id = $2`,
            Number(projetoId), empresaId
        );

        if (!projetoExiste || projetoExiste.length === 0) {
            console.warn(`[Projetos/MoverColuna] Projeto #${projetoId} não encontrado.`);
            return res.status(404).json({ message: 'Projeto não encontrado.' });
        }

        const colunaAnterior = projetoExiste[0].coluna;
        console.log(`[Projetos/MoverColuna] Movendo projeto #${projetoId} de "${colunaAnterior}" → "${novaColuna}"`);

        // Calcula nova ordem (final da coluna de destino)
        const ordemResult = await prisma.$queryRawUnsafe(
            `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM kanban_projetos WHERE empresa_id = $1 AND coluna = $2 AND id != $3`,
            empresaId, novaColuna, Number(projetoId)
        );
        const novaOrdem = Number(ordemResult[0]?.proxima_ordem || 1);

        // Atualiza coluna e ordem
        await prisma.$queryRawUnsafe(
            `UPDATE kanban_projetos SET coluna = $1, ordem = $2, atualizado_em = NOW() WHERE id = $3 AND empresa_id = $4`,
            novaColuna, novaOrdem, Number(projetoId), empresaId
        );

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
    }
};

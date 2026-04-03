const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, nome } = req.body;
        if (!sessionToken) return res.status(401).json({ message: 'Sessão inválida' });
        if (!nome || !nome.trim()) return res.status(400).json({ message: 'Nome inválido.' });

        let empresaId = null;
        let isAdmin = false;

        // Autenticar admin
        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, f.permissoes 
            FROM painel_usuarios u
            JOIN painel_funcoes f ON u.funcao_id = f.id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
            let permissoes = users[0].permissoes;
            if (typeof permissoes === 'string') {
                try { permissoes = JSON.parse(permissoes); } catch (e) { permissoes = []; }
            }
            if (Array.isArray(permissoes) && permissoes.includes('admin')) isAdmin = true;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
                isAdmin = true;
            }
        }

        if (!isAdmin || !empresaId) return res.status(403).json({ message: 'Acesso negado. Requer permissão de administrador.' });

        await prisma.$executeRawUnsafe(`
            INSERT INTO impressoras (empresa_id, nome, ativo, criado_em)
            VALUES ($1, $2, true, NOW())
        `, empresaId, nome.trim());

        return res.status(200).json({ message: "Impressora criada com sucesso!" });

    } catch (error) {
        console.error("Erro POST adicionar_impressora:", error);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

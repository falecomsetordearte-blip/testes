const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(401).json({ message: 'Sessão inválida' });

        // 1. Identificar Empresa e validar se tem acesso ADMIN
        let empresaId = null;
        let isAdmin = false;

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
            if (Array.isArray(permissoes) && permissoes.includes('admin')) {
                isAdmin = true;
            }
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
                isAdmin = true; // Dono da empresa tem acesso ADMIN nativo
            }
        }

        if (!isAdmin || !empresaId) {
            return res.status(403).json({ message: 'Acesso negado. Requer permissão de administrador.' });
        }

        // 2. Buscar Configurações
        const configs = await prisma.$queryRawUnsafe(`
            SELECT prazo_padrao_impressao, prazo_padrao_acabamento
            FROM painel_configuracoes_sistema
            WHERE empresa_id = $1 LIMIT 1
        `, empresaId);

        if (configs.length === 0) {
            // Se ainda não existir config, retorna os padrões documentados no Prisma
            return res.status(200).json({
                config: {
                    prazo_padrao_impressao: 24,
                    prazo_padrao_acabamento: 24
                }
            });
        }

        return res.status(200).json({ config: configs[0] });

    } catch (error) {
        console.error("Erro GET config:", error);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

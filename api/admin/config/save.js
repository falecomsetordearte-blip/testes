const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, prazoImpressao, prazoAcabamento } = req.body;
        if (!sessionToken) return res.status(401).json({ message: 'Sessão inválida' });

        // 1. Identificar Empresa e validar se tem acesso ADMIN
        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, f.permissoes 
            FROM painel_usuarios u
            JOIN painel_funcoes f ON u.funcao_id = f.id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length === 0) {
            return res.status(403).json({ message: 'Acesso negado. Usuário não encontrado no novo painel.' });
        }

        const user = users[0];
        let permissoes = user.permissoes;
        if (typeof permissoes === 'string') {
            try { permissoes = JSON.parse(permissoes); } catch (e) { permissoes = []; }
        }

        if (!Array.isArray(permissoes) || !permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Requer permissão de administrador.' });
        }

        const empresaId = user.empresa_id;
        const impHoras = parseInt(prazoImpressao) || 24;
        const acaHoras = parseInt(prazoAcabamento) || 24;

        // 2. Salvar ou Atualizar Configurações (Upsert)
        const upsertConfig = await prisma.$executeRawUnsafe(`
            INSERT INTO painel_configuracoes_sistema (empresa_id, prazo_padrao_impressao, prazo_padrao_acabamento, atualizado_em)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (empresa_id) 
            DO UPDATE SET 
                prazo_padrao_impressao = EXCLUDED.prazo_padrao_impressao,
                prazo_padrao_acabamento = EXCLUDED.prazo_padrao_acabamento,
                atualizado_em = NOW()
        `, empresaId, impHoras, acaHoras);

        return res.status(200).json({ success: true, message: "Configurações salvas!" });

    } catch (error) {
        console.error("Erro SAVE config:", error);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

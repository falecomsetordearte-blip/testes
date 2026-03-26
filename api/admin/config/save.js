const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, prazoImpressao, prazoAcabamento, mensagens_etapas } = req.body;
        if (!sessionToken) return res.status(401).json({ message: 'Sessão inválida' });

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
            if (Array.isArray(permissoes) && permissoes.includes('admin')) isAdmin = true;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
                isAdmin = true;
            }
        }

        if (!isAdmin || !empresaId) return res.status(403).json({ message: 'Acesso negado. Requer permissão de administrador.' });

        const impHoras = parseInt(prazoImpressao) || 24;
        const acaHoras = parseInt(prazoAcabamento) || 24;
        const jsonMensagens = JSON.stringify(mensagens_etapas || {});

        const upsertConfig = await prisma.$executeRawUnsafe(`
            INSERT INTO painel_configuracoes_sistema (empresa_id, prazo_padrao_impressao, prazo_padrao_acabamento, mensagens_etapas, atualizado_em)
            VALUES ($1, $2, $3, $4::jsonb, NOW())
            ON CONFLICT (empresa_id) 
            DO UPDATE SET 
                prazo_padrao_impressao = EXCLUDED.prazo_padrao_impressao,
                prazo_padrao_acabamento = EXCLUDED.prazo_padrao_acabamento,
                mensagens_etapas = EXCLUDED.mensagens_etapas,
                atualizado_em = NOW()
        `, empresaId, impHoras, acaHoras, jsonMensagens);

        return res.status(200).json({ success: true, message: "Configurações salvas!" });

    } catch (error) {
        console.error("Erro SAVE config:", error);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};
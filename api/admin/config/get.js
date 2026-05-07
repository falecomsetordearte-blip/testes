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

        // Mensagens padrão de fábrica
        const msgsPadrao = {
            ARTE: "Seu pedido está na etapa de Arte. Nossa equipe está cuidando dos detalhes com muito carinho.",
            IMPRESSAO: "Ótima notícia! Seu pedido acabou de ir para a Impressão. Em breve tomará forma.",
            ACABAMENTO: "A impressão terminou! Agora estamos nos acabamentos finais para deixar tudo perfeito.",
            EXPEDICAO: "Tudo pronto! Seu pedido está na nossa expedição aguardando retirada ou rota de entrega.",
            INSTALACAO_LOJA: "Tudo pronto! Seu pedido já está liberado e aguardando a instalação aqui na loja.",
            INSTALACAO_EXTERNA: "Tudo pronto! Seu pedido já entrou na nossa rota para a instalação externa no seu local.",
            INDOOR_VEICULAR: "Olá [NOME]! 🎉\n\nSua arte está pronta e aprovada para veicular! Em breve nosso time vai entrar em contato com os próximos passos.",
            INDOOR_CONCLUIDO: "Olá [NOME]! ✅\n\nSeu pedido foi concluído com sucesso. Obrigado pela confiança!"
        };

        const configs = await prisma.$queryRawUnsafe(`
            SELECT prazo_padrao_impressao, prazo_padrao_acabamento, mensagens_etapas
            FROM painel_configuracoes_sistema
            WHERE empresa_id = $1 LIMIT 1
        `, empresaId);

        const empresaData = await prisma.$queryRawUnsafe(`
            SELECT chatapp_plano, chatapp_status, chatapp_qr_link, plan_type
            FROM empresas
            WHERE id = $1 LIMIT 1
        `, empresaId);

        if (configs.length === 0) {
            return res.status(200).json({
                config: {
                    prazo_padrao_impressao: 24,
                    prazo_padrao_acabamento: 24,
                    mensagens_etapas: msgsPadrao
                },
                chatapp: empresaData[0] || {}
            });
        }

        let dbMsgs = configs[0].mensagens_etapas;
        if (typeof dbMsgs === 'string') { try { dbMsgs = JSON.parse(dbMsgs); } catch(e) { dbMsgs = null; } }
        
        // Mescla o que tá no banco com o padrão (para cobrir campos vazios)
        const finalMsgs = { ...msgsPadrao, ...(dbMsgs || {}) };
        
        configs[0].mensagens_etapas = finalMsgs;

        return res.status(200).json({ config: configs[0], chatapp: empresaData[0] || {} });

    } catch (error) {
        console.error("Erro GET config:", error);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};
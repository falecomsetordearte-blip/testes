const prisma = require('../lib/prisma');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId } = req.body;
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Token e ID do pedido são obrigatórios.' });
        }

        // 1. Identificar Usuário e Empresa do sessionToken (Neon/Postgres)
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        let empresaId = null;
        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) empresaId = empresasLegacy[0].id;
        }

        if (!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });
        
        // 2. Buscar dados do pedido localmente
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT * FROM pedidos 
            WHERE id = $1 AND empresa_id = $2 LIMIT 1
        `, parseInt(dealId), empresaId);

        if (pedidos.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou sem permissão.' });
        }

        const pedido = pedidos[0];

        // 3. Buscar os dados do designer responsável localmente (se houver mapping)
        let designerInfo = {
            nome: 'Setor de Arte',
            avatar: 'https://setordearte.com.br/images/logo-redonda.svg'
        };
        
        const designerId = pedido.assigned_by_id;
        if (designerId) {
            const designers = await prisma.$queryRawUnsafe(`SELECT nome FROM painel_usuarios WHERE id = $1 LIMIT 1`, parseInt(designerId));
            if (designers.length > 0) {
                designerInfo.nome = designers[0].nome;
            }
        }
        
        // 4. Buscar o histórico de mensagens (Localmente)
        // Como o bitrix foi removido, tentamos buscar na tabela local pedido_mensagens se existir
        let historicoMensagens = [];
        try {
            const msgs = await prisma.$queryRawUnsafe(`SELECT texto, remetente FROM pedido_mensagens WHERE pedido_id = $1 ORDER BY criado_em ASC`, parseInt(dealId));
            historicoMensagens = msgs.map(m => ({
                texto: m.texto,
                remetente: m.remetente // 'cliente' ou 'designer'
            }));
        } catch (e) {
            console.log("Tabela pedido_mensagens ainda não existe ou vazia.");
        }

        // 5. Montar a resposta final
        return res.status(200).json({
            status: 'success',
            pedido: {
                ID: pedido.id,
                TITLE: pedido.titulo || String(pedido.id),
                STAGE_ID: pedido.etapa,
                OPPORTUNITY: (parseFloat(pedido.valor_venda || 0) + parseFloat(pedido.valor_designer || 0)) / 0.9,
                NOME_CLIENTE_FINAL: pedido.nome_cliente,
                LINK_ATENDIMENTO: pedido.link_acompanhar || '',
                LINK_ARQUIVO_FINAL: pedido.link_arquivo_impressao || '',
                designerInfo: designerInfo,
                historicoMensagens: historicoMensagens,
                jaAvaliado: false // Lógica de avaliação pode ser migrada depois
            }
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os detalhes do pedido.' });
    }
};
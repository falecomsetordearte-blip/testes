const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { enviarMensagemTexto } = require('./helpers/chatapp');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId, message } = req.body;

        if (!sessionToken || !dealId || !message) {
            return res.status(400).json({ message: 'Token, ID do pedido e mensagem são obrigatórios.' });
        }

        // 1. Identificar Usuário e Empresa do sessionToken (Neon/Postgres)
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id, nome FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        let empresaId = null;
        let remetenteNome = 'Atendimento';

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
            remetenteNome = users[0].nome;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id, nome_fantasia FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
                remetenteNome = empresasLegacy[0].nome_fantasia;
            }
        }

        if (!empresaId) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }
        
        // 2. Verificar se o pedido pertence à empresa
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, chatapp_chat_id, chatapp_chat_notificacoes_id 
            FROM pedidos 
            WHERE id = $1 AND empresa_id = $2 LIMIT 1
        `, parseInt(dealId), empresaId);

        if (pedidos.length === 0) {
            return res.status(403).json({ message: 'Acesso negado ou pedido não encontrado.' });
        }
        
        const pedido = pedidos[0];
        
        // 3. Enviar a mensagem via ChatApp (WhatsApp)
        // Tentamos enviar no grupo de produção ou no de notificações
        const chatIdParaEnvio = pedido.chatapp_chat_id || pedido.chatapp_chat_notificacoes_id;
        
        if (chatIdParaEnvio) {
            const formattedComment = `*[${remetenteNome}]*\n${message}`;
            await enviarMensagemTexto(chatIdParaEnvio, formattedComment);
        } else {
            console.warn(`[sendMessage] Pedido ${dealId} não possui canal de chat configurado.`);
        }

        return res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso localmente!' });

    } catch (error) {
        console.error('Erro ao enviar mensagem local:', error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno ao processar a mensagem.' });
    }
};
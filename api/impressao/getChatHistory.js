const prisma = require('../../lib/prisma');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId } = req.body;
        if (!dealId) {
            return res.status(400).json({ message: 'ID do Pedido é obrigatório.' });
        }
        
        // 1. Tentar buscar mensagens locais no Neon/Postgres
        let historicoMensagens = [];
        try {
            const msgs = await prisma.$queryRawUnsafe(`
                SELECT texto, remetente FROM pedido_mensagens 
                WHERE pedido_id = $1 ORDER BY criado_em ASC
            `, parseInt(dealId));
            
            historicoMensagens = msgs.map(m => ({
                texto: m.texto,
                remetente: m.remetente 
            }));
        } catch (e) {
            console.log("Tabela pedido_mensagens não encontrada. Retornando vazio.");
        }

        return res.status(200).json({ messages: historicoMensagens });

    } catch (error) {
        console.error(`[getChatHistory] Erro:`, error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar o histórico local.' });
    }
};
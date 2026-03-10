// Arquivo: /api/designer/sendChat.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { getChatAppToken } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    try {
        const { pedidoId, texto } = req.body;

        const pedido = await prisma.$queryRawUnsafe(`SELECT chatapp_chat_id FROM pedidos WHERE id = $1`, Number(pedidoId));
        if (!pedido || pedido.length === 0 || !pedido[0].chatapp_chat_id) {
            return res.status(404).json({ message: "Chat do grupo não localizado." });
        }

        const chatId = pedido[0].chatapp_chat_id;
        const token = await getChatAppToken();
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        const L_MSG = 'grWhatsApp'; 

        const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
        
        // Identificando de onde veio (opcional, mas legal para o grupo saber que foi o designer)
        const mensagemFinal = `*Designer:* ${texto}`;

        await axios.post(url, { text: mensagemFinal }, { headers: { 'Authorization': token, 'Lang': 'pt' } });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro ao enviar mensagem:", error.message);
        return res.status(500).json({ message: "Erro ao enviar mensagem." });
    }
};
// Arquivo: /api/designer/sendChat.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { getChatAppToken } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    try {
        const { pedidoId, texto, tipoChat } = req.body;

        const pedido = await prisma.$queryRawUnsafe(`SELECT chatapp_chat_id, chatapp_chat_intern_id FROM pedidos WHERE id = $1`, Number(pedidoId));
        if (!pedido || pedido.length === 0) {
            return res.status(404).json({ message: "Pedido não localizado." });
        }

        const chatId = tipoChat === 'interno' ? pedido[0].chatapp_chat_intern_id : pedido[0].chatapp_chat_id;

        if (!chatId) {
            return res.status(404).json({ message: "Chat específico não localizado." });
        }

        const token = await getChatAppToken();
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        const L_MSG = 'grWhatsApp'; 

        const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
        
        const mensagemFinal = `*Designer:* ${texto}`;

        await axios.post(url, { text: mensagemFinal }, { headers: { 'Authorization': token, 'Lang': 'pt' } });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro ao enviar mensagem:", error.message);
        return res.status(500).json({ message: "Erro ao enviar mensagem." });
    }
};
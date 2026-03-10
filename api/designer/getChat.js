// Arquivo: /api/designer/getChat.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { getChatAppToken } = require('../helpers/chatapp'); // Agora funciona!

module.exports = async (req, res) => {
    try {
        const { pedidoId } = req.body;
        const pedido = await prisma.$queryRawUnsafe(`SELECT chatapp_chat_id FROM pedidos WHERE id = $1`, Number(pedidoId));
        
        if (!pedido || pedido.length === 0 || !pedido[0].chatapp_chat_id) {
            return res.status(404).json({ message: "Chat não encontrado." });
        }
        
        const chatId = pedido[0].chatapp_chat_id;
        const token = await getChatAppToken();
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        const L_MSG = 'grWhatsApp'; 

        const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages?limit=50&direction=prev`;
        
        const response = await axios.get(url, { headers: { 'Authorization': token, 'Lang': 'pt' } });
        
        let mensagens = response.data?.data?.items || [];
        mensagens = mensagens.reverse();

        const chatFormatado = mensagens.map(m => ({
            id: m.id,
            texto: m.message?.text || (m.type === 'image' ? '📷 Imagem' : `📎 ${m.type}`),
            lado: m.side,
            remetente: m.fromUser?.name || 'Cliente',
            hora: m.time
        }));

        return res.status(200).json({ success: true, mensagens: chatFormatado });

    } catch (error) {
        console.error("Erro ao puxar chat:", error.message);
        return res.status(500).json({ message: "Erro ao conectar com o WhatsApp." });
    }
};
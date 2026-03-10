// Arquivo: /api/designer/getChat.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
// Importa o gerador de token que você já tem
const { getChatAppToken } = require('../helpers/chatapp'); 

module.exports = async (req, res) => {
    try {
        const { pedidoId } = req.body; // Vem do painel do designer

        // 1. Achar o pedido e o chatId no banco
        const pedido = await prisma.$queryRawUnsafe(`SELECT chatapp_chat_id FROM pedidos WHERE id = $1`, Number(pedidoId));
        
        if (!pedido || pedido.length === 0 || !pedido[0].chatapp_chat_id) {
            return res.status(404).json({ message: "Chat não encontrado para este pedido." });
        }
        
        const chatId = pedido[0].chatapp_chat_id;

        // 2. Pegar o Token do ChatApp
        const token = await getChatAppToken();
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        const L_MSG = 'grWhatsApp'; 

        // 3. Buscar mensagens no ChatApp (limite 50 mensagens)
        const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages?limit=50&direction=prev`;
        
        const response = await axios.get(url, { headers: { 'Authorization': token, 'Lang': 'pt' } });
        
        // As mensagens vêm da mais nova pra mais velha. Vamos inverter para ficar como no WhatsApp (mais velha em cima, nova embaixo)
        let mensagens = response.data?.data?.items ||[];
        mensagens = mensagens.reverse();

        // Limpamos o JSON para enviar pro front-end só o que importa
        const chatFormatado = mensagens.map(m => ({
            id: m.id,
            texto: m.message?.text || (m.type === 'image' ? '📷 Imagem' : `📎 ${m.type}`),
            lado: m.side, // 'in' = cliente enviou, 'out' = nós enviamos
            remetente: m.fromUser?.name || 'Cliente',
            hora: m.time // timestamp
        }));

        return res.status(200).json({ success: true, mensagens: chatFormatado });

    } catch (error) {
        console.error("Erro ao puxar chat:", error.message);
        return res.status(500).json({ message: "Erro ao conectar com o WhatsApp." });
    }
};
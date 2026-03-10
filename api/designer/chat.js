// Arquivo: /api/designer/chat.js - VERSÃO CORRIGIDA COM CORS

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { getChatAppToken } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    // --- INÍCIO DA CORREÇÃO DE CORS ---
    // Permite que seu front-end (app.setordearte.com.br) acesse esta API
    res.setHeader('Access-Control-Allow-Origin', '*'); // Ou 'https://app.setordearte.com.br' para mais segurança
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // O navegador envia uma requisição "OPTIONS" antes do POST para checar as permissões.
    // Precisamos responder "OK" para ela.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    // --- FIM DA CORREÇÃO DE CORS ---

    const { action, pedidoId, texto } = req.body;

    try {
        const pedido = await prisma.$queryRawUnsafe(`SELECT chatapp_chat_id FROM pedidos WHERE id = $1`, Number(pedidoId));
        if (!pedido || pedido.length === 0 || !pedido[0].chatapp_chat_id) {
            return res.status(404).json({ message: "Chat do grupo não localizado no banco." });
        }

        const chatId = pedido[0].chatapp_chat_id;
        const token = await getChatAppToken();
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        const L_MSG = 'grWhatsApp'; 

        // ROTA DE LEITURA
        if (action === 'get') {
            const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages?limit=50&direction=prev`;
            const response = await axios.get(url, { headers: { 'Authorization': token } });
            
            let mensagens = (response.data?.data?.items || []).reverse();

            const chatFormatado = mensagens.map(m => ({
                id: m.id,
                texto: m.message?.text || (m.type === 'image' ? '📷 Imagem' : `📎 ${m.type}`),
                lado: m.side,
                remetente: m.fromUser?.name || 'Participante',
                hora: m.time
            }));
            return res.status(200).json({ success: true, mensagens: chatFormatado });
        }

        // ROTA DE ENVIO
        if (action === 'send') {
            const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
            const mensagemFinal = `*Designer:* ${texto}`;
            await axios.post(url, { text: mensagemFinal }, { headers: { 'Authorization': token } });
            return res.status(200).json({ success: true, message: "Mensagem enviada." });
        }

        return res.status(400).json({ message: "Ação inválida. Use 'get' ou 'send'." });

    } catch (error) {
        console.error("Erro na API do Chat:", error.response?.data || error.message);
        return res.status(500).json({ message: "Erro ao se comunicar com a API do Chat." });
    }
};
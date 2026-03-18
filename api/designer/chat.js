// Arquivo: /api/designer/chat.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const { IncomingForm } = require('formidable');
const fs = require('fs');
const { getChatAppToken } = require('../helpers/chatapp');

export const config = {
    api: {
        bodyParser: false, // Necessário para Formidable no Vercel
    },
};

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const form = new IncomingForm();
    
    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ message: "Erro ao processar formulário." });

        const action = Array.isArray(fields.action) ? fields.action[0] : fields.action;
        const pedidoId = Array.isArray(fields.pedidoId) ? fields.pedidoId[0] : fields.pedidoId;
        const texto = Array.isArray(fields.texto) ? fields.texto[0] : fields.texto;
        const designerNome = Array.isArray(fields.designerNome) ? fields.designerNome[0] : fields.designerNome;
        const arquivo = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;

        try {
            const pedidoRes = await prisma.$queryRawUnsafe(`SELECT chatapp_chat_id FROM pedidos WHERE id = $1`, Number(pedidoId));
            if (!pedidoRes || pedidoRes.length === 0 || !pedidoRes[0].chatapp_chat_id) {
                return res.status(404).json({ message: "Chat não localizado." });
            }

            const chatId = pedidoRes[0].chatapp_chat_id;
            const token = await getChatAppToken();
            const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
            const L_MSG = 'grWhatsApp'; 

            if (action === 'get') {
                const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages?limit=50&direction=prev`;
                const response = await axios.get(url, { headers: { 'Authorization': token } });
                
                let itens = (response.data?.data?.items || []).reverse();

                const mensagens = itens.map(m => {
                    const file = m.message?.file;
                    return {
                        id: m.id,
                        type: m.type, // text, image, audio, voice, video, file
                        texto: m.message?.text || m.message?.caption || '',
                        file: file ? {
                            link: file.link,
                            name: file.name,
                            contentType: file.contentType
                        } : null,
                        lado: m.side,
                        remetente: m.fromUser?.name || 'Cliente',
                        hora: m.time
                    };
                });
                return res.status(200).json({ success: true, mensagens });
            }

            if (action === 'send') {
                let url = '';
                let data = null;
                let headers = { 'Authorization': token };

                if (arquivo) {
                    url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/file`;
                    const fd = new FormData();
                    fd.append('file', fs.createReadStream(arquivo.filepath), { filename: arquivo.originalFilename });
                    if (texto) fd.append('caption', `*${designerNome}:* ${texto}`);
                    else fd.append('caption', `*${designerNome}*`);
                    
                    data = fd;
                    Object.assign(headers, fd.getHeaders());
                } else {
                    url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
                    data = { text: `*${designerNome}:* ${texto}` };
                    headers['Content-Type'] = 'application/json';
                }

                await axios.post(url, data, { headers });
                return res.status(200).json({ success: true, message: "Mensagem enviada." });
            }

            return res.status(400).json({ message: "Ação inválida." });

        } catch (error) {
            console.error("Erro API Chat:", error.response?.data || error.message);
            return res.status(500).json({ message: "Erro na comunicação com o chat." });
        }
    });
};
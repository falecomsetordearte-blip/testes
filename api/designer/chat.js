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
        
        // NOVO: Recebe o tipo do chat ('cliente' ou 'interno')
        const tipoChat = Array.isArray(fields.tipoChat) ? fields.tipoChat[0] : (fields.tipoChat || 'cliente');
        
        const arquivo = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;

        try {
            // Busca os DOIS IDs no banco de dados
            const pedidoRes = await prisma.$queryRawUnsafe(`
                SELECT chatapp_chat_id, chatapp_chat_intern_id 
                FROM pedidos WHERE id = $1
            `, Number(pedidoId));
            
            if (!pedidoRes || pedidoRes.length === 0) {
                return res.status(404).json({ message: "Pedido não localizado." });
            }

            // Define qual chatId usar com base no botão que o usuário clicou
            const chatId = tipoChat === 'interno' ? pedidoRes[0].chatapp_chat_intern_id : pedidoRes[0].chatapp_chat_id;

            if (!chatId) {
                return res.status(404).json({ message: "Este chat específico não foi criado/localizado para este pedido." });
            }

            const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
            const L_MSG = 'grWhatsApp'; 

            // --- SISTEMA DE AUTO-CURA (RENOVAÇÃO DE TOKEN) ---
            const fetchWithRetry = async (method, url, data, customHeaders = {}) => {
                let token = await getChatAppToken();
                let headers = { ...customHeaders, 'Authorization': token };

                try {
                    return await axios({ method, url, data, headers });
                } catch (error) {
                    const errCode = error.response?.data?.error?.code;
                    if (errCode === 'ApiInvalidTokenError' || error.response?.status === 401) {
                        console.log("[CHATAPP] Token expirado na leitura/envio. Forçando renovação rápida...");
                        await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => {});
                        token = await getChatAppToken(true); 
                        headers['Authorization'] = token;
                        return await axios({ method, url, data, headers });
                    }
                    throw error; 
                }
            };
            // --------------------------------------------------

            if (action === 'get') {
                const url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages?limit=50&direction=prev`;
                
                const response = await fetchWithRetry('GET', url, null);
                
                let itens = (response.data?.data?.items || []).reverse();

                const mensagens = itens.map(m => {
                    const file = m.message?.file;
                    return {
                        id: m.id,
                        type: m.type, 
                        texto: m.message?.text || m.message?.caption || '',
                        file: file ? {
                            link: file.link,
                            name: file.name,
                            contentType: file.contentType
                        } : null,
                        lado: m.side,
                        remetente: m.fromUser?.name || 'Participante',
                        hora: m.time
                    };
                });
                return res.status(200).json({ success: true, mensagens });
            }

            if (action === 'send') {
                let url = '';
                let data = null;
                let headers = {};

                if (arquivo) {
                    url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/file`;
                    const fd = new FormData();
                    fd.append('file', fs.createReadStream(arquivo.filepath), { filename: arquivo.originalFilename });
                    if (texto) fd.append('caption', `*${designerNome}:* ${texto}`);
                    else fd.append('caption', `*${designerNome}*`);
                    
                    data = fd;
                    headers = fd.getHeaders();
                } else {
                    url = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
                    data = { text: `*${designerNome}:* ${texto}` };
                    headers['Content-Type'] = 'application/json';
                }

                await fetchWithRetry('POST', url, data, headers);
                
                return res.status(200).json({ success: true, message: "Mensagem enviada." });
            }

            return res.status(400).json({ message: "Ação inválida." });

        } catch (error) {
            console.error("Erro API Chat:", error.response?.data || error.message);
            return res.status(500).json({ message: "Erro na comunicação com o chat." });
        }
    });
};
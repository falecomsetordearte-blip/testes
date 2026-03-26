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
        bodyParser: false, // Necessário para Formidable no Vercel/Node
    },
};

module.exports = async (req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const form = new IncomingForm();
    
    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error("[CHAT API] Erro ao processar form:", err);
            return res.status(500).json({ message: "Erro ao processar formulário." });
        }

        const action = Array.isArray(fields.action) ? fields.action[0] : fields.action;
        const pedidoId = Array.isArray(fields.pedidoId) ? fields.pedidoId[0] : fields.pedidoId;
        const texto = Array.isArray(fields.texto) ? fields.texto[0] : fields.texto;
        const designerNome = Array.isArray(fields.designerNome) ? fields.designerNome[0] : fields.designerNome;
        const tipoChat = Array.isArray(fields.tipoChat) ? fields.tipoChat[0] : (fields.tipoChat || 'cliente');
        const pedidosRaw = Array.isArray(fields.pedidos) ? fields.pedidos[0] : fields.pedidos;
        
        const arquivo = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;

        console.log(`[CHAT API] Ação: ${action} | Pedido: ${pedidoId || 'N/A'} | Tipo: ${tipoChat}`);

        try {
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
                        console.log("[CHATAPP] Token expirado. Renovando...");
                        await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => {});
                        token = await getChatAppToken(true); 
                        headers['Authorization'] = token;
                        return await axios({ method, url, data, headers });
                    }
                    throw error; 
                }
            };

            // --- NOVO: AÇÃO PARA CHECAR TODOS OS PEDIDOS DE UMA VEZ (NOTIFICAÇÕES) ---
            if (action === 'check_all') {
                if (!pedidosRaw) return res.status(400).json({ message: "Lista de pedidos ausente." });
                
                const idsParaChecar = JSON.parse(pedidosRaw);
                console.log(`[CHAT NOTIF] Verificando ${idsParaChecar.length} pedidos para notificações.`);

                const results = await prisma.$queryRawUnsafe(`
                    SELECT id, chatapp_chat_id, chatapp_chat_intern_id 
                    FROM pedidos WHERE id = ANY($1::int[])
                `, idsParaChecar);

                const latestMessages = {};

                // Buscamos a última mensagem de cada chat (cliente e interno)
                // Usamos Promise.all para ser mais rápido, mas ChatApp pode ter rate limit se forem muitos pedidos
                await Promise.all(results.map(async (p) => {
                    latestMessages[p.id] = { cliente: null, interno: null };

                    // Última do Cliente
                    if (p.chatapp_chat_id) {
                        try {
                            const urlC = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${p.chatapp_chat_id}/messages?limit=1&direction=prev`;
                            const resC = await fetchWithRetry('GET', urlC, null);
                            const lastC = resC.data?.data?.items?.[0];
                            if (lastC) {
                                latestMessages[p.id].cliente = { id: lastC.id, side: lastC.side, time: lastC.time };
                            }
                        } catch (e) { console.error(`[CHAT NOTIF] Erro check cliente pId ${p.id}`); }
                    }

                    // Última da Gráfica (Interno)
                    if (p.chatapp_chat_intern_id) {
                        try {
                            const urlI = `https://api.chatapp.online/v1/licenses/${L_ID}/messengers/${L_MSG}/chats/${p.chatapp_chat_intern_id}/messages?limit=1&direction=prev`;
                            const resI = await fetchWithRetry('GET', urlI, null);
                            const lastI = resI.data?.data?.items?.[0];
                            if (lastI) {
                                latestMessages[p.id].interno = { id: lastI.id, side: lastI.side, time: lastI.time };
                            }
                        } catch (e) { console.error(`[CHAT NOTIF] Erro check interno pId ${p.id}`); }
                    }
                }));

                console.log(`[CHAT NOTIF] Checagem concluída para ${results.length} pedidos.`);
                return res.status(200).json({ success: true, latestMessages });
            }

            // --- AÇÕES ORIGINAIS (GET / SEND) ---
            if (!pedidoId) return res.status(400).json({ message: "ID do pedido é obrigatório para esta ação." });

            const pedidoRes = await prisma.$queryRawUnsafe(`
                SELECT chatapp_chat_id, chatapp_chat_intern_id 
                FROM pedidos WHERE id = $1
            `, Number(pedidoId));
            
            if (!pedidoRes || pedidoRes.length === 0) {
                return res.status(404).json({ message: "Pedido não localizado." });
            }

            const chatId = tipoChat === 'interno' ? pedidoRes[0].chatapp_chat_intern_id : pedidoRes[0].chatapp_chat_id;

            if (!chatId) {
                return res.status(404).json({ message: "Este chat específico não foi localizado para este pedido." });
            }

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
                console.log(`[CHAT API] Mensagem enviada com sucesso no chat ${chatId}`);
                
                return res.status(200).json({ success: true, message: "Mensagem enviada." });
            }

            return res.status(400).json({ message: "Ação inválida." });

        } catch (error) {
            console.error("[CHAT API ERROR]", error.response?.data || error.message);
            return res.status(500).json({ message: "Erro na comunicação com o servidor de chat." });
        }
    });
};
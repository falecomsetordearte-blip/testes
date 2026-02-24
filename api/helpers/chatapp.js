// /api/helpers/chatapp.js - VERSÃO FINAL (CORREÇÃO grWhatsApp)

const axios = require('axios');
const CHATAPP_API = 'https://api.chatapp.online/v1';

async function getChatAppToken() {
    try {
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });
        return response.data?.data?.accessToken;
    } catch (error) {
        console.error("[CHATAPP AUTH ERROR]", error.response?.data || error.message);
        return null;
    }
}

async function criarGrupoProducao(titulo, supervisorWpp, briefing) {
    console.log("--- [CHATAPP AUTOMATION] Iniciando Varredura de Licenças ---");
    
    const token = await getChatAppToken();
    if (!token) return null;

    const headers = { 'Authorization': token };

    try {
        const resLic = await axios.get(`${CHATAPP_API}/licenses`, { headers });
        const lista = resLic.data?.data || resLic.data || [];
        
        let licencaCerta = null;
        let messengerType = null;

        // BUSCA PELA LICENÇA ATIVA QUE TENHA WHATSAPP (QUALQUER TIPO)
        for (const item of lista) {
            if (item.active && item.messenger && item.messenger.length > 0) {
                // Procuramos qualquer mensageiro que tenha "whatsapp" no nome (ignorando maiúsculas/minúsculas)
                const wp = item.messenger.find(m => m.type.toLowerCase().includes('whatsapp'));
                
                if (wp) {
                    licencaCerta = item;
                    messengerType = wp.type; // Captura o tipo exato (ex: grWhatsApp)
                    console.log(`[DEBUG] >>> LICENÇA VÁLIDA ENCONTRADA: ${item.licenseId} (Tipo: ${messengerType})`);
                    break;
                }
            }
        }

        if (!licencaCerta) {
            console.error("[ERROR] Nenhuma licença ativa com WhatsApp encontrada.");
            return null;
        }

        const L_ID = licencaCerta.licenseId || licencaCerta.id;

        // 1. CRIAR GRUPO
        // Usamos o messengerType exato retornado pela API (grWhatsApp)
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messenger/${messengerType}/groups`;
        const foneLimpo = supervisorWpp.replace(/\D/g, '');

        console.log(`[DEBUG] Criando grupo na URL: ${urlGroups}`);
        
        const resGrupo = await axios.post(urlGroups, {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        }, { headers });

        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP GROUP] Resposta sem ID de chat:", JSON.stringify(resGrupo.data));
            return null;
        }

        // 2. ENVIAR BRIEFING
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messenger/${messengerType}/messages`;
        console.log(`[DEBUG] Enviando briefing para: ${chatId}`);

        await axios.post(urlMsg, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO DE ARTE*\n\n*Pedido:* ${titulo}\n\n*Briefing:* \n${briefing}\n\n---`
        }, { headers });

        console.log("[CHATAPP] Automação concluída com sucesso!");
        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP FATAL ERROR] ---");
        if (error.response) {
            console.error(`Status: ${error.response.status} | Dados: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`Mensagem: ${error.message}`);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
// /api/helpers/chatapp.js - CORREÇÃO DE ENDPOINT (grWhatsApp -> gr-whatsapp)

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
        
        let lic = lista.find(l => l.active && l.messenger && l.messenger.length > 0 && l.messenger.some(m => m.type.toLowerCase().includes('whatsapp')));

        if (!lic) {
            console.error("[ERROR] Nenhuma licença ativa com WhatsApp encontrada.");
            return null;
        }

        const L_ID = lic.licenseId || lic.id;
        const rawType = lic.messenger[0].type;
        
        // --- CORREÇÃO DO NOME DO MENSAGEIRO PARA A URL ---
        // Se for grWhatsApp, a URL correta é gr-whatsapp
        let L_MSG = rawType === 'grWhatsApp' ? 'gr-whatsapp' : 'whatsapp';
        
        console.log(`[DEBUG] Licença: ${L_ID} | Tipo Original: ${rawType} | Tipo URL: ${L_MSG}`);

        const foneLimpo = supervisorWpp.replace(/\D/g, '');
        const payloadGrupo = {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        };

        // 1. TENTATIVA DE CRIAR GRUPO
        let resGrupo;
        try {
            const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/groups`;
            console.log(`[DEBUG] Tentativa 1 (URL: ${L_MSG}): ${urlGroups}`);
            resGrupo = await axios.post(urlGroups, payloadGrupo, { headers });
        } catch (err404) {
            if (err404.response?.status === 404 && L_MSG === 'gr-whatsapp') {
                console.warn("[DEBUG] 404 com gr-whatsapp. Tentando fallback para 'whatsapp'...");
                L_MSG = 'whatsapp';
                const urlGroupsFallback = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/groups`;
                resGrupo = await axios.post(urlGroupsFallback, payloadGrupo, { headers });
            } else {
                throw err404; // Se não for 404 ou não for gr, repassa o erro
            }
        }

        console.log("[CHATAPP GROUP] Resposta Sucesso:", JSON.stringify(resGrupo.data));
        
        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink;

        // 2. ENVIAR BRIEFING
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/messages`;
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
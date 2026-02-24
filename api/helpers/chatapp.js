// /api/helpers/chatapp.js - CORREÇÃO DE HEADER (SEM BEARER)

const axios = require('axios');
const CHATAPP_API = 'https://api.chatapp.online/v1';

async function getChatAppToken() {
    console.log("--- [CHATAPP AUTH] Solicitando Token ---");
    try {
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });

        const token = response.data?.data?.accessToken;
        if (token) {
            console.log(`[CHATAPP AUTH] Token obtido: ${token.substring(0, 5)}...`);
            return token;
        }
        return null;
    } catch (error) {
        console.error("[CHATAPP AUTH ERROR]", error.response?.data || error.message);
        return null;
    }
}

async function criarGrupoProducao(titulo, supervisorWpp, briefing) {
    console.log("--- [CHATAPP AUTOMATION] Iniciando Auto-Descoberta ---");
    
    const token = await getChatAppToken();
    if (!token) return null;

    // IMPORTANTE: No ChatApp v1, o header NÃO leva a palavra "Bearer"
    const headers = { 'Authorization': token };

    try {
        // 1. DESCOBERTA DE LICENÇA
        console.log("[DEBUG] Listando licenças com o token...");
        const resLic = await axios.get(`${CHATAPP_API}/licenses`, { headers });

        const listaLicencas = resLic.data?.data || resLic.data || [];
        console.log(`[DEBUG] Licenças encontradas: ${listaLicencas.length}`);

        // Prioridade: Licença 'whatsapp' (QR Code) que esteja online
        const lic = listaLicencas.find(l => l.messenger === 'whatsapp' && l.status === 'online') 
                  || listaLicencas.find(l => l.messenger === 'whatsapp')
                  || listaLicencas[0];

        if (!lic) {
            console.error("[ERROR] Nenhuma licença disponível.");
            return null;
        }

        const L_ID = lic.id; 
        const L_MSG = lic.messenger;
        console.log(`[DEBUG] Usando Licença: ${L_ID} (${L_MSG})`);

        // 2. CRIAR GRUPO
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/groups`;
        const foneLimpo = supervisorWpp.replace(/\D/g, '');

        console.log(`[DEBUG] Criando grupo em: ${urlGroups}`);
        const resGrupo = await axios.post(urlGroups, {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        }, { headers });

        console.log("[CHATAPP GROUP] Resposta:", JSON.stringify(resGrupo.data));
        
        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP GROUP] Falha ao obter ChatID.");
            return null;
        }

        // 3. ENVIAR BRIEFING
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
            console.error(`Status: ${error.response.status}`);
            console.error(`Dados: ${JSON.stringify(error.response.data)}`);
            
            if (error.response.status === 403) {
                console.error("[DICA] Erro 403 mesmo sem Bearer? Verifique se o IP do seu servidor (Vercel) precisa ser liberado no painel do ChatApp (Whitelist).");
            }
        } else {
            console.error(`Mensagem: ${error.message}`);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
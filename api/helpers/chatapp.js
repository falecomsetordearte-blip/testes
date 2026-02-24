// /api/helpers/chatapp.js - VERSÃO AUTO-SCAN (ESPECIAL QR CODE)

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

        // A estrutura correta é response.data.data.accessToken
        if (response.data?.data?.accessToken) {
            console.log("[CHATAPP AUTH] Token obtido com sucesso!");
            return response.data.data.accessToken;
        }
        console.error("[CHATAPP AUTH] Resposta sem token:", JSON.stringify(response.data));
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

    try {
        // 1. DESCOBERTA: Listar licenças para evitar Erro 404
        console.log("[DEBUG] Listando licenças da conta...");
        const resLic = await axios.get(`${CHATAPP_API}/licenses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const listaLicencas = resLic.data?.data || resLic.data || [];
        console.log(`[DEBUG] Total de licenças encontradas: ${listaLicencas.length}`);

        // Procuramos a licença de WhatsApp (QR Code) que esteja online
        // Priorizamos 'whatsapp' (QR Code) sobre 'gr-whatsapp' (API Oficial)
        const licencaValida = listaLicencas.find(l => l.messenger === 'whatsapp' && l.status === 'online') 
                           || listaLicencas.find(l => l.messenger === 'whatsapp')
                           || listaLicencas[0];

        if (!licencaValida) {
            console.error("[ERROR] Nenhuma licença encontrada na conta.");
            return null;
        }

        // O ChatApp v1 usa o campo 'id' ou 'licenseId' na URL. Vamos testar o 'id' que é o padrão.
        const L_ID = licencaValida.id; 
        const L_MSG = licencaValida.messenger; // Geralmente 'whatsapp' para QR Code

        console.log(`[DEBUG] Selecionada Licença: ${L_ID} | Tipo: ${L_MSG} | Status: ${licencaValida.status}`);

        // 2. CRIAR O GRUPO
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/groups`;
        const foneLimpo = supervisorWpp.replace(/\D/g, '');

        console.log(`[DEBUG] Chamando POST em: ${urlGroups}`);
        
        const resGrupo = await axios.post(urlGroups, {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("[CHATAPP GROUP] Resposta do Servidor:", JSON.stringify(resGrupo.data));
        
        // Extração do ID do grupo (pode variar conforme retorno da API)
        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP GROUP] O grupo foi criado mas não retornou ID.");
            return null;
        }

        // 3. ENVIAR O BRIEFING
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/messages`;
        console.log(`[DEBUG] Enviando mensagem inicial para chat: ${chatId}`);

        await axios.post(urlMsg, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO DE ARTE*\n\n*Pedido:* ${titulo}\n\n*Briefing:* \n${briefing}\n\n---`
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("[CHATAPP] Fluxo completo com sucesso!");
        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP FATAL ERROR] ---");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Detalhes: ${JSON.stringify(error.response.data)}`);
            
            if (error.response.status === 404) {
                console.error("[DICA] Erro 404 persistente. Isso indica que o endpoint de grupos para licenças QR Code pode ser diferente ou a licença ID informada pela API não é a que deve ser usada na URL.");
            }
        } else {
            console.error(`Mensagem: ${error.message}`);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
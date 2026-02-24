// /api/helpers/chatapp.js - CORREÇÃO DE MAPEAMENTO DE LICENÇA

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
        if (token) return token;
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

    const headers = { 'Authorization': token };

    try {
        // 1. DESCOBERTA DE LICENÇA
        const resLic = await axios.get(`${CHATAPP_API}/licenses`, { headers });
        const listaLicencas = resLic.data?.data || resLic.data || [];
        
        console.log(`[DEBUG] Licenças encontradas: ${listaLicencas.length}`);

        if (listaLicencas.length === 0) {
            console.error("[ERROR] Nenhuma licença encontrada na conta.");
            return null;
        }

        // Log da primeira licença para debug de nomes de campos
        console.log("[DEBUG] Estrutura da primeira licença:", JSON.stringify(listaLicencas[0]));

        // Filtra licenças de WhatsApp (QR Code)
        const lic = listaLicencas.find(l => (l.messenger === 'whatsapp' || l.type === 'whatsapp') && l.status === 'online') 
                  || listaLicencas.find(l => l.messenger === 'whatsapp' || l.type === 'whatsapp')
                  || listaLicencas[0];

        // MAPEAMENTO ROBUSTO: Tenta vários nomes de campos comuns na API deles
        const L_ID = lic.licenseId || lic.id || lic.license_id; 
        const L_MSG = lic.messenger || lic.type || 'whatsapp';

        console.log(`[DEBUG] Escolhida Licença: ${L_ID} | Tipo: ${L_MSG}`);

        if (!L_ID) {
            console.error("[ERROR] Não foi possível extrair um ID de licença válido.");
            return null;
        }

        // 2. CRIAR GRUPO
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/groups`;
        const foneLimpo = supervisorWpp.replace(/\D/g, '');

        console.log(`[DEBUG] POST em: ${urlGroups}`);
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
            console.error(`Status: ${error.response.status} | Dados: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`Mensagem: ${error.message}`);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
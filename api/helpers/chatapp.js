// /api/helpers/chatapp.js - CORREÇÃO DE ENDPOINT 404

const axios = require('axios');

const CHATAPP_API = 'https://api.chatapp.online/v1';

async function getChatAppToken() {
    console.log("--- [CHATAPP AUTH] Obtendo token ---");
    try {
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });

        if (response.data && response.data.data && response.data.data.accessToken) {
            return response.data.data.accessToken;
        }
        return null;
    } catch (error) {
        console.error("[CHATAPP AUTH ERROR]", error.response?.data || error.message);
        return null;
    }
}

async function criarGrupoProducao(titulo, supervisorWpp, briefing) {
    console.log("--- [CHATAPP GROUP] Iniciando criação ---");
    
    const token = await getChatAppToken();
    if (!token) return null;

    const licencaId = process.env.CHATAPP_LICENSE_ID;
    const foneLimpo = supervisorWpp.replace(/\D/g, '');

    // AJUSTE: Trocamos 'gr-whatsapp' por 'whatsapp' que é o padrão para licenças via QR Code
    // Se o erro 404 persistir, verifique se o ID da Licença na Vercel está correto.
    const urlCriarGrupo = `${CHATAPP_API}/licenses/${licencaId}/messenger/whatsapp/groups`;
    
    console.log(`[DEBUG] URL Chamada: ${urlCriarGrupo}`);
    console.log(`[DEBUG] Licença ID usada: ${licencaId}`);

    try {
        // 1. Criar o Grupo
        const resGrupo = await axios.post(urlCriarGrupo, {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("[CHATAPP GROUP] Resposta Raw:", JSON.stringify(resGrupo.data));
        
        // A API pode retornar em data.id ou direto em id
        const resultData = resGrupo.data.data || resGrupo.data;
        const chatId = resultData.id;
        const groupLink = resultData.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP GROUP] Erro: Resposta sem chatId.");
            return null;
        }

        // 2. Enviar Briefing
        const urlMensagem = `${CHATAPP_API}/licenses/${licencaId}/messenger/whatsapp/messages`;
        console.log(`[CHATAPP GROUP] Enviando briefing para chat: ${chatId}`);

        await axios.post(urlMensagem, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO DE ARTE*\n\n*Pedido:* ${titulo}\n\n*Briefing:* \n${briefing}\n\n---`
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("[CHATAPP GROUP] Processo finalizado com sucesso.");
        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP GROUP ERROR] ---");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Dados: ${JSON.stringify(error.response.data)}`);
            
            if (error.response.status === 404) {
                console.error("[ALERTA 404] A API não encontrou este caminho. Verifique se o CHATAPP_LICENSE_ID na Vercel é exatamente o número da sua licença no painel do ChatApp.");
            }
        } else {
            console.error(`Erro: ${error.message}`);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
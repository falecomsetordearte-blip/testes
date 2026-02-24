const axios = require('axios');

const CHATAPP_API = 'https://api.chatapp.online/v1';

async function getChatAppToken() {
    console.log("--- [CHATAPP AUTH] Iniciando obtenção de token ---");
    
    const email = process.env.CHATAPP_EMAIL;
    const pass = process.env.CHATAPP_PASSWORD;
    const appId = process.env.CHATAPP_APP_ID;

    if (!email || !pass || !appId) {
        console.error("[CHATAPP AUTH] Erro: Variáveis de ambiente não configuradas.");
        return null;
    }

    try {
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: email,
            password: pass,
            appId: appId
        });

        // CORREÇÃO AQUI: A API retorna { data: { accessToken: '...' } }
        // O Axios coloca isso dentro de response.data, então fica response.data.data.accessToken
        if (response.data && response.data.data && response.data.data.accessToken) {
            console.log("[CHATAPP AUTH] Token obtido com sucesso!");
            return response.data.data.accessToken;
        } else {
            console.error("[CHATAPP AUTH] Resposta inesperada:", JSON.stringify(response.data));
            return null;
        }
    } catch (error) {
        console.error("--- [CHATAPP AUTH ERROR] ---");
        if (error.response) {
            console.error("Dados do Erro:", JSON.stringify(error.response.data));
        }
        return null;
    }
}

async function criarGrupoProducao(titulo, supervisorWpp, briefing) {
    console.log("--- [CHATAPP GROUP] Iniciando criação de grupo ---");
    
    const token = await getChatAppToken();
    if (!token) return null;

    const licencaId = process.env.CHATAPP_LICENSE_ID;
    const foneLimpo = supervisorWpp.replace(/\D/g, '');

    try {
        console.log(`[CHATAPP GROUP] Criando grupo: "ARTE: ${titulo}"`);
        
        const resGrupo = await axios.post(`${CHATAPP_API}/licenses/${licencaId}/messenger/gr-whatsapp/groups`, {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // O ChatApp costuma retornar o ID do grupo dentro de data.id ou direto no result
        console.log("[CHATAPP GROUP] Grupo criado:", JSON.stringify(resGrupo.data));
        
        // Ajuste preventivo para pegar o ID do grupo (dependendo da versão da API deles)
        const chatId = resGrupo.data.data ? resGrupo.data.data.id : resGrupo.data.id;
        const groupLink = resGrupo.data.data ? resGrupo.data.data.inviteLink : resGrupo.data.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP GROUP] Falha ao capturar ChatID da resposta.");
            return null;
        }

        // Enviar Briefing inicial
        console.log(`[CHATAPP GROUP] Enviando briefing para: ${chatId}`);
        await axios.post(`${CHATAPP_API}/licenses/${licencaId}/messenger/gr-whatsapp/messages`, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO DE ARTE*\n\n*Pedido:* ${titulo}\n\n*Briefing:* \n${briefing}\n\n---`
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP GROUP ERROR] ---");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Resposta API:", JSON.stringify(error.response.data));
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
const axios = require('axios');

const CHATAPP_API = 'https://api.chatapp.online/v1';

async function getChatAppToken() {
    console.log("--- [CHATAPP AUTH] Iniciando obtenção de token ---");
    
    // Log de segurança: verifica se as variáveis existem (sem mostrar a senha toda)
    const email = process.env.CHATAPP_EMAIL;
    const pass = process.env.CHATAPP_PASSWORD;
    const appId = process.env.CHATAPP_APP_ID;

    if (!email || !pass || !appId) {
        console.error("[CHATAPP AUTH] Erro: Variáveis CHATAPP_EMAIL, CHATAPP_PASSWORD ou CHATAPP_APP_ID não configuradas na Vercel.");
        return null;
    }

    try {
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: email,
            password: pass,
            appId: appId
        });

        if (response.data && response.data.accessToken) {
            console.log("[CHATAPP AUTH] Token obtido com sucesso.");
            return response.data.accessToken;
        } else {
            console.error("[CHATAPP AUTH] Resposta inesperada (sem accessToken):", JSON.stringify(response.data));
            return null;
        }
    } catch (error) {
        console.error("--- [CHATAPP AUTH ERROR] Falha Crítica ---");
        if (error.response) {
            console.error("Status do Erro:", error.response.status);
            console.error("Detalhes do Erro da API:", JSON.stringify(error.response.data));
        } else {
            console.error("Mensagem de erro local:", error.message);
        }
        return null;
    }
}

async function criarGrupoProducao(titulo, supervisorWpp, briefing) {
    console.log("--- [CHATAPP GROUP] Iniciando criação de grupo ---");
    
    const token = await getChatAppToken();
    if (!token) {
        console.error("[CHATAPP GROUP] Abortando: Falha na autenticação inicial.");
        return null;
    }

    const licencaId = process.env.CHATAPP_LICENSE_ID;
    if (!licencaId) {
        console.error("[CHATAPP GROUP] Erro: CHATAPP_LICENSE_ID não configurado.");
        return null;
    }

    // Limpa o número do supervisor (apenas números)
    const foneLimpo = supervisorWpp.replace(/\D/g, '');

    try {
        console.log(`[CHATAPP GROUP] Tentando criar grupo: "ARTE: ${titulo}" na licença ${licencaId}`);
        
        // Chamada para criar o grupo
        const resGrupo = await axios.post(`${CHATAPP_API}/licenses/${licencaId}/messenger/gr-whatsapp/groups`, {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("[CHATAPP GROUP] Resposta da criação do grupo:", JSON.stringify(resGrupo.data));

        const chatId = resGrupo.data.id;
        const groupLink = resGrupo.data.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP GROUP] Grupo criado mas ChatID veio vazio.");
            return null;
        }

        // Enviar Briefing inicial
        console.log(`[CHATAPP GROUP] Enviando briefing para o chat: ${chatId}`);
        await axios.post(`${CHATAPP_API}/licenses/${licencaId}/messenger/gr-whatsapp/messages`, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO DE ARTE*\n\n*Pedido:* ${titulo}\n\n*Briefing:* \n${briefing}\n\n---`
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("[CHATAPP GROUP] Briefing enviado com sucesso.");
        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP GROUP ERROR] Falha ao criar grupo ou enviar mensagem ---");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Resposta da API:", JSON.stringify(error.response.data));
            
            // Verificação comum: licença expirada ou WhatsApp desconectado
            if (JSON.stringify(error.response.data).includes("not authorized")) {
                console.error("[DICA] O WhatsApp pode estar desconectado no painel do ChatApp.");
            }
        } else {
            console.error("Erro técnico:", error.message);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
// /api/helpers/chatapp.js - BASEADO NA DOCUMENTAÇÃO OFICIAL CHATAPP

const axios = require('axios');
const CHATAPP_API = 'https://api.chatapp.online/v1';

async function getChatAppToken() {
    try {
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });
        // Resposta conforme Swagger: data.data.accessToken
        return response.data?.data?.accessToken;
    } catch (error) {
        console.error("[CHATAPP AUTH ERROR]", error.response?.data || error.message);
        return null;
    }
}

async function criarGrupoProducao(titulo, supervisorWpp, briefing) {
    console.log("--- [CHATAPP] Iniciando automação conforme documentação ---");
    
    const token = await getChatAppToken();
    if (!token) return null;

    // Header sem 'Bearer' conforme Quick Start
    const headers = { 'Authorization': token };

    try {
        // 1. DESCOBERTA DA LICENÇA CORRETA
        const resLic = await axios.get(`${CHATAPP_API}/licenses`, { headers });
        const lista = resLic.data?.data || resLic.data || [];
        
        // Buscamos a licença que você está usando (59808)
        const lic = lista.find(l => String(l.licenseId) === "59808" || (l.active && l.messenger?.length > 0));

        if (!lic) {
            console.error("[CHATAPP] Erro: Nenhuma licença ativa encontrada.");
            return null;
        }

        const L_ID = lic.licenseId || lic.id;
        
        /**
         * REGRA DA DOCUMENTAÇÃO:
         * Mesmo que o tipo no JSON venha 'grWhatsApp', na URL do endpoint v1 
         * deve-se usar 'gr-whatsapp' para contas Business QR Code.
         */
        const L_MSG = 'gr-whatsapp'; 

        // 2. CRIAR O GRUPO
        // Endpoint: /licenses/{licenseId}/messenger/{messengerType}/groups
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/groups`;
        
        // Limpa o número: 55 + DDD + Numero
        const foneLimpo = supervisorWpp.replace(/\D/g, '');

        /**
         * PAYLOAD CONFORME DOCUMENTAÇÃO (Swagger):
         * O campo correto é "phones" e deve ser um array de strings.
         */
        const payloadGrupo = {
            name: `ARTE: ${titulo}`,
            phones: [ foneLimpo ] 
        };

        console.log(`[CHATAPP] Criando grupo em: ${urlGroups}`);
        
        const resGrupo = await axios.post(urlGroups, payloadGrupo, { headers });

        // A API v1 retorna os dados do grupo no objeto 'data'
        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP] Grupo criado mas não retornou ID. Resposta:", JSON.stringify(resGrupo.data));
            return null;
        }

        // 3. ENVIAR BRIEFING PARA O GRUPO
        // Endpoint: /licenses/{licenseId}/messenger/{messengerType}/messages
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/messages`;
        
        console.log(`[CHATAPP] Enviando briefing para o grupo ID: ${chatId}`);

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
            console.error(`Resposta API: ${JSON.stringify(error.response.data)}`);
            
            // Tratamento especial para erro de permissão de grupo
            if (error.response.status === 403) {
                console.error("[DICA] Algumas licenças QR Code precisam que a opção 'Allow creating groups' esteja ativa no painel do ChatApp.");
            }
        } else {
            console.error(`Erro: ${error.message}`);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
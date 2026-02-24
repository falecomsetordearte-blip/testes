// /api/helpers/chatapp.js - VERSÃO EXPLORATÓRIA DE ENDPOINT

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
    console.log("--- [CHATAPP AUTOMATION] Iniciando Busca de Endpoint Válido ---");
    
    const token = await getChatAppToken();
    if (!token) return null;

    const headers = { 'Authorization': token };

    try {
        // 1. Identificar Licença Ativa
        const resLic = await axios.get(`${CHATAPP_API}/licenses`, { headers });
        const lista = resLic.data?.data || resLic.data || [];
        const lic = lista.find(l => l.active && l.messenger?.length > 0);

        if (!lic) {
            console.error("[ERROR] Nenhuma licença ativa encontrada.");
            return null;
        }

        const L_ID = lic.licenseId || lic.id;
        const foneLimpo = supervisorWpp.replace(/\D/g, '');
        const payloadGrupo = {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        };

        // 2. TESTAR VARIAÇÕES DE URL (Uma delas deve funcionar)
        // Tentaremos os formatos mais comuns para licenças QR Code
        const rotasParaTestar = [
            `${CHATAPP_API}/licenses/${L_ID}/messenger/gr-whatsapp/groups`, // Padrão Kebab
            `${CHATAPP_API}/licenses/${L_ID}/messenger/whatsapp/groups`,    // Padrão Simples
            `${CHATAPP_API}/licenses/${L_ID}/gr-whatsapp/groups`,           // Sem a palavra 'messenger'
            `${CHATAPP_API}/licenses/${L_ID}/whatsapp/groups`               // Sem 'messenger' e simples
        ];

        let resGrupo = null;
        let urlVencedora = null;
        let messengerTypeUsado = null;

        for (const url of rotasParaTestar) {
            try {
                console.log(`[DEBUG] Testando URL: ${url}`);
                const tentativa = await axios.post(url, payloadGrupo, { headers });
                
                if (tentativa.status === 200 || tentativa.status === 201) {
                    resGrupo = tentativa;
                    urlVencedora = url;
                    // Detecta qual messenger type funcionou para usar na mensagem depois
                    messengerTypeUsado = url.includes('gr-whatsapp') ? 'gr-whatsapp' : 'whatsapp';
                    console.log(`[DEBUG] >>> SUCESSO na URL: ${url}`);
                    break;
                }
            } catch (err) {
                console.log(`[DEBUG] Falha na URL (${url}): ${err.response?.status || err.message}`);
                continue; // Tenta a próxima
            }
        }

        if (!resGrupo) {
            console.error("[ERROR] Todas as tentativas de URL para criação de grupo falharam com 404.");
            return null;
        }

        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink;

        // 3. ENVIAR BRIEFING (Usando a estrutura que funcionou acima)
        // Se a URL do grupo funcionou sem a palavra 'messenger', a mensagem também deve seguir o mesmo padrão
        let urlMsg = urlVencedora.replace('/groups', '/messages');
        
        console.log(`[DEBUG] Enviando briefing para: ${chatId} via ${urlMsg}`);

        await axios.post(urlMsg, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO DE ARTE*\n\n*Pedido:* ${titulo}\n\n*Briefing:* \n${briefing}\n\n---`
        }, { headers });

        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP FATAL ERROR] ---", error.response?.data || error.message);
        return null;
    }
}

module.exports = { criarGrupoProducao };
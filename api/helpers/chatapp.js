// /api/helpers/chatapp.js - VERSÃO BUSCA AVANÇADA (MULTI-LICENÇA)

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
        // 1. DESCOBERTA: Listar todas as licenças
        const resLic = await axios.get(`${CHATAPP_API}/licenses`, { headers });
        const lista = resLic.data?.data || resLic.data || [];
        
        console.log(`[DEBUG] Total de licenças na conta: ${lista.length}`);

        // 2. BUSCA INTELIGENTE: Procurar a licença correta
        let licencaCerta = null;

        for (const item of lista) {
            // Verifica se a licença está ativa e se tem o mensageiro whatsapp nela
            const temWhatsapp = item.messenger && item.messenger.some(m => m.type === 'whatsapp');
            
            console.log(`[DEBUG] Analisando Licença ${item.licenseId}: Ativa=${item.active}, Messengers=${JSON.stringify(item.messenger)}`);

            if (item.active === true && temWhatsapp) {
                licencaCerta = item;
                console.log(`[DEBUG] >>> LICENÇA VÁLIDA ENCONTRADA: ${item.licenseId}`);
                break; 
            }
        }

        // Caso não ache uma 100% ativa, tenta pegar qualquer uma que tenha whatsapp
        if (!licencaCerta) {
            console.log("[DEBUG] Nenhuma licença 100% ativa achada. Tentando fallback para qualquer uma com WhatsApp...");
            licencaCerta = lista.find(item => item.messenger && item.messenger.some(m => m.type === 'whatsapp'));
        }

        if (!licencaCerta) {
            console.error("[ERROR] Nenhuma das 4 licenças possui o mensageiro WhatsApp configurado.");
            return null;
        }

        const L_ID = licencaCerta.licenseId || licencaCerta.id;
        const L_MSG = 'whatsapp'; // Forçamos whatsapp pois validamos no some() acima

        // 3. CRIAR GRUPO
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/groups`;
        const foneLimpo = supervisorWpp.replace(/\D/g, '');

        console.log(`[DEBUG] Criando grupo na licença ${L_ID}...`);
        const resGrupo = await axios.post(urlGroups, {
            name: `ARTE: ${titulo}`,
            participants: [ { phone: foneLimpo } ] 
        }, { headers });

        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink;

        if (!chatId) {
            console.error("[CHATAPP GROUP] Resposta sem ID de chat.");
            return null;
        }

        // 4. ENVIAR BRIEFING
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messenger/${L_MSG}/messages`;
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
// /api/helpers/chatapp.js - BASEADO NA DOCUMENTAÇÃO OFICIAL CHATAPP

const axios = require('axios');
const CHATAPP_API = 'https://api.chatapp.online/v1';

let cachedToken = null;
let lastAuthTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos em milissegundos

async function getChatAppToken() {
    const now = Date.now();
    if (cachedToken && (now - lastAuthTime < CACHE_DURATION)) {
        return cachedToken;
    }

    try {
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });
        
        const token = response.data?.accessToken || response.data?.data?.accessToken;
        if (token) {
            cachedToken = token;
            lastAuthTime = now;
        }
        return token;
    } catch (error) {
        console.error("[CHATAPP AUTH ERROR]", error.response?.data || error.message);
        return cachedToken; // Retorna o último token conhecido em caso de erro de rate limit na auth
    }
}

// Função auxiliar para formatar os telefones para o padrão WhatsApp (com 55)
function formatarTelefone(telefone) {
    if (!telefone) return null;
    let limpo = telefone.toString().replace(/\D/g, ''); // Remove tudo que não é número
    
    // Se o número tiver 10 ou 11 dígitos, é do Brasil e está sem o DDI, então adiciona '55'
    if (limpo.length === 10 || limpo.length === 11) {
        limpo = '55' + limpo;
    }
    return limpo; // Retorna apenas os números limpos
}

async function criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing) {
    console.log("--- [CHATAPP] Iniciando automação de criação de Grupo ---");
    
    const token = await getChatAppToken();
    if (!token) {
        console.error("[CHATAPP] Falha ao obter o Token de autenticação.");
        return null;
    }

    const headers = { 
        'Authorization': token, 
        'Content-Type': 'application/json',
        'Lang': 'pt'
    };

    try {
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        const L_MSG = 'grWhatsApp'; 

        const numCliente = formatarTelefone(wppCliente);
        const numSupervisor = formatarTelefone(supervisorWpp);
        
        const participantsItems =[];
        
        if (numCliente) participantsItems.push({ value: numCliente });
        if (numSupervisor) participantsItems.push({ value: numSupervisor });

        if (participantsItems.length === 0) {
            console.error("[CHATAPP] Erro: Nenhum número de telefone válido fornecido.");
            return null;
        }

        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;
        
        const payloadGrupo = {
            type: "group",
            name: `Pedido: ${titulo}`.substring(0, 25),
            participantsType: "phone",
            participantsItems: participantsItems
        };

        const resGrupo = await axios.post(urlGroups, payloadGrupo, { headers });

        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink || '';

        if (!chatId) {
            console.error("[CHATAPP] Erro ao criar grupo.");
            return null;
        }

        // 3. ENVIAR BRIEFING
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
        
        await axios.post(urlMsg, {
            text: `🚀 *NOVO PEDIDO INICIADO*\n\n*Serviço:* ${titulo}\n\n*Briefing de Arte:* \n${briefing}\n\n---`
        }, { headers });

        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP FATAL ERROR] ---", error.response?.data || error.message);
        return null;
    }
}

// CORREÇÃO: Exportando ambas as funções para o seu getChat.js conseguir ler
module.exports = { criarGrupoProducao, getChatAppToken };
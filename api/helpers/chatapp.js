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
        // A API v1 retorna o token em accessToken ou data.accessToken
        return response.data?.accessToken || response.data?.data?.accessToken;
    } catch (error) {
        console.error("[CHATAPP AUTH ERROR]", error.response?.data || error.message);
        return null;
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

// ATUALIZADO: Agora recebe o telefone do cliente e do supervisor
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
        // Licença fixa do seu sistema (ou puxe de process.env.CHATAPP_LICENSE_ID)
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        
        // Tipo de mensageiro conforme a documentação oficial recente
        const L_MSG = 'grWhatsApp'; 

        // 1. FORMATAR OS NÚMEROS E PREPARAR A LISTA DE PARTICIPANTES
        const numCliente = formatarTelefone(wppCliente);
        const numSupervisor = formatarTelefone(supervisorWpp);
        
        const participantsItems =[];
        
        if (numCliente) {
            participantsItems.push({ value: numCliente });
        }
        if (numSupervisor) {
            participantsItems.push({ value: numSupervisor });
        }

        if (participantsItems.length === 0) {
            console.error("[CHATAPP] Erro: Nenhum número de telefone válido fornecido. Grupo abortado.");
            return null;
        }

        // 2. CRIAR O GRUPO
        // Endpoint oficial: POST v1/licenses/{licenseId}/messengers/{messengerType}/chats
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;
        
        const payloadGrupo = {
            type: "group", // Obrigatório
            name: `Pedido: ${titulo}`.substring(0, 25), // Nome do grupo dinâmico (com limite de 25 chars)
            participantsType: "phone",
            participantsItems: participantsItems // Envia Cliente + Supervisor
        };

        console.log(`[CHATAPP] Criando grupo em: ${urlGroups}`);
        console.log(`[CHATAPP] Participantes:`, participantsItems);
        
        const resGrupo = await axios.post(urlGroups, payloadGrupo, { headers });

        // A API retorna os dados do grupo no objeto 'data'
        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink || '';

        if (!chatId) {
            console.error("[CHATAPP] Grupo criado mas não retornou ID. Resposta:", JSON.stringify(resGrupo.data));
            return null;
        }

        console.log(`[CHATAPP] Grupo Criado com Sucesso! ID do Chat: ${chatId}`);

        // 3. ENVIAR BRIEFING AUTOMÁTICO DENTRO DO NOVO GRUPO
        // Endpoint oficial de mensagens
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/messages`;
        
        console.log(`[CHATAPP] Enviando mensagem de Briefing para o grupo recém-criado...`);

        await axios.post(urlMsg, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO INICIADO*\n\n*Serviço:* ${titulo}\n\n*Briefing de Arte:* \n${briefing}\n\n---`
        }, { headers });

        console.log("[CHATAPP] Mensagem enviada! Automação concluída.");
        return { chatId, groupLink };

    } catch (error) {
        console.error("--- [CHATAPP FATAL ERROR] ---");
        if (error.response) {
            console.error(`Status HTTP: ${error.response.status}`);
            console.error(`Resposta API: ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 403) {
                console.error("[DICA] Certifique-se de que a permissão 'Allow creating groups' está ativa no painel do ChatApp.");
            }
        } else {
            console.error(`Erro: ${error.message}`);
        }
        return null;
    }
}

module.exports = { criarGrupoProducao };
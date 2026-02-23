const axios = require('axios');

const CHATAPP_API = 'https://api.chatapp.online/v1';

async function getChatAppToken() {
    try {
        const res = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });
        return res.data.accessToken;
    } catch (error) {
        console.error("Erro ao autenticar no ChatApp:", error.response?.data || error.message);
        return null;
    }
}

async function criarGrupoProducao(titulo, supervisorWpp, briefing) {
    const token = await getChatAppToken();
    if (!token) return null;

    const licencaId = process.env.CHATAPP_LICENSE_ID;

    try {
        // 1. Criar o Grupo no WhatsApp através da licença
        // Nota: O ChatApp requer que você envie os números que farão parte
        const resGrupo = await axios.post(`${CHATAPP_API}/licenses/${licencaId}/messenger/gr-whatsapp/groups`, {
            name: `ARTE: ${titulo}`,
            // Aqui você adicionaria o número do Supervisor e do Designer se já os tivesse
            participants: [ { phone: supervisorWpp.replace(/\D/g, '') } ] 
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const chatId = resGrupo.data.id; // ID do grupo recém criado
        const groupLink = resGrupo.data.inviteLink; // Link de convite

        // 2. Enviar o Briefing inicial para dentro do grupo
        await axios.post(`${CHATAPP_API}/licenses/${licencaId}/messenger/gr-whatsapp/messages`, {
            chatId: chatId,
            text: `🚀 *NOVO PEDIDO DE ARTE*\n\n*Pedido:* ${titulo}\n\n*Briefing:* \n${briefing}\n\n---`
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return { chatId, groupLink };

    } catch (error) {
        console.error("Erro ao criar grupo no ChatApp:", error.response?.data || error.message);
        return null;
    }
}

module.exports = { criarGrupoProducao };
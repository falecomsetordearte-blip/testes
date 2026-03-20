// /api/helpers/chatapp.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const CHATAPP_API = 'https://api.chatapp.online/v1';
const prisma = new PrismaClient();

// --- Garante a tabela de configuração ---
async function garantirTabelaConfig() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS system_config (
                chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TIMESTAMPTZ DEFAULT NOW()
            )`);
    } catch (e) {}
}

// --- Busca token ou gera um novo ---
async function getChatAppToken(forceRefresh = false) {
    if (!forceRefresh) {
        try {
            await garantirTabelaConfig();
            const rows = await prisma.$queryRawUnsafe(`SELECT valor FROM system_config WHERE chave = 'chatapp_token' LIMIT 1`);
            if (rows.length > 0) return rows[0].valor;
        } catch (e) {}
    }

    // Se não tem no banco ou forçado: Autentica
    try {
        console.log('[CHATAPP] Autenticando para obter NOVO token...');
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });

        const token = response.data?.accessToken || response.data?.data?.accessToken;
        if (token) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO system_config (chave, valor, atualizado_em) VALUES ('chatapp_token', $1, NOW())
                ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()
            `, token);
            return token;
        }
        return null;
    } catch (error) {
        console.error("[CHATAPP AUTH ERROR]", error.message);
        return null;
    }
}

// --- Formata telefone (Garante string limpa para a API) ---
function formatarTelefone(telefone) {
    if (!telefone) return null;
    let limpo = telefone.toString().replace(/\D/g, '');
    if (limpo.length === 10 || limpo.length === 11) limpo = '55' + limpo;
    return limpo.length >= 12 ? parseInt(limpo, 10) : null;
}

// --- Função Principal com Retry (Tentativa de recuperação) ---
async function criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, retry = true) {
    console.log(`--- [CHATAPP] Iniciando automação (Tentativa: ${retry ? '1' : '2 (Retry)'}) ---`);

    const token = await getChatAppToken(!retry); // Se for retry, força um token novo
    if (!token) return null;

    const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
    const L_ID = process.env.CHATAPP_LICENSE_ID || '59808';
    const L_MSG = 'grWhatsApp';

    try {
        const numCliente = formatarTelefone(wppCliente);
        const numSupervisor = formatarTelefone(supervisorWpp);

        const participantsItems = [];
        if (numCliente) participantsItems.push({ value: numCliente });
        if (numSupervisor) participantsItems.push({ value: numSupervisor });

        if (participantsItems.length === 0) return null;

        // 1. Tenta criar o grupo
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;
        const resGrupo = await axios.post(urlGroups, {
            type: "group",
            name: `Pedido: ${titulo}`.substring(0, 50),
            participantsType: "phone",
            participantsItems: participantsItems
        }, { headers });

        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink || '';

        if (!chatId) return null;

        // Aguarda propagação
        await new Promise(r => setTimeout(r, 3000));

        // 2. Tenta enviar o briefing
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
        await axios.post(urlMsg, {
            text: `🚀 *NOVO PEDIDO INICIADO*\n\n*Serviço:* ${titulo}\n\n*Briefing de Arte:* \n${briefing}\n\n---`
        }, { headers });

        console.log(`[CHATAPP] Grupo criado com sucesso: ${chatId}`);
        return { chatId, groupLink };

    } catch (error) {
        const errData = error.response?.data || {};
        const errCode = errData.error?.code || "";

        // SE O ERRO FOR TOKEN INVÁLIDO E AINDA NÃO TENTAMOS O RETRY
        if ((errCode === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            console.warn("[CHATAPP] Token inválido detectado. Limpando cache e tentando novamente...");
            
            // Apaga o token bichado do banco
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => {});
            
            // Chama a função novamente forçando um novo token (retry = false para não entrar em loop infinito)
            return await criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, false);
        }

        console.error("[CHATAPP FATAL ERROR]", JSON.stringify(errData, null, 2));
        return null;
    }
}

module.exports = { criarGrupoProducao, getChatAppToken };
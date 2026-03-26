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
async function criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, nomeCliente = 'Cliente', nomeEmpresa = 'nossa gráfica', retry = true) {
    console.log(`--- [CHATAPP] Iniciando automação DUPLA (Tentativa: ${retry ? '1' : '2 (Retry)'}) ---`);

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

        // =========================================================
        // 1. CRIAÇÃO DO GRUPO 1 (CLIENTE + SUPERVISÃO + DESIGNER)
        // =========================================================
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;
        const resGrupo1 = await axios.post(urlGroups, {
            type: "group",
            name: `Pedido: ${titulo}`.substring(0, 50),
            participantsType: "phone",
            participantsItems: participantsItems
        }, { headers });

        const gData1 = resGrupo1.data?.data || resGrupo1.data;
        const chatId1 = gData1.id;
        const groupLink1 = gData1.inviteLink || '';

        // Aguarda propagação
        await new Promise(r => setTimeout(r, 2000));

        // Envia briefing no Grupo 1
        if (chatId1) {
            await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId1}/messages/text`, {
                text: `🚀 *NOVO PEDIDO INICIADO*\n\n*Serviço:* ${titulo}\n\n*Briefing de Arte:* \n${briefing}\n\n---`
            }, { headers });
        }

        // =========================================================
        // 2. CRIAÇÃO DO GRUPO 2 (APENAS SUPERVISÃO + DESIGNER)
        // =========================================================
        let chatIdInterno = null;
        let groupLinkInterno = '';

        if (numSupervisor) {
            const resGrupo2 = await axios.post(urlGroups, {
                type: "group",
                name: `${titulo} - Designer`.substring(0, 50),
                participantsType: "phone",
                participantsItems: [{ value: numSupervisor }]
            }, { headers });

            const gData2 = resGrupo2.data?.data || resGrupo2.data;
            chatIdInterno = gData2.id;
            groupLinkInterno = gData2.inviteLink || '';

            // Aguarda propagação
            await new Promise(r => setTimeout(r, 2000));

            // Envia mensagem específica no Grupo 2
            if (chatIdInterno) {
                await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatIdInterno}/messages/text`, {
                    text: `Nesse grupo aqui não tem o cliente. Se precisar falar só comigo sobre esse pedido use por aqui.`
                }, { headers });
            }
        }

        // =========================================================
        // 3. ENVIO DE MENSAGENS DIRETAS (PV / INBOX)
        // =========================================================
        
        // Mensagem direta para o CLIENTE
        if (numCliente && groupLink1) {
            try {
                // <--- ALTERADO AQUI PARA A FRASE EXATA QUE VOCÊ PEDIU --->
                await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numCliente}/messages/text`, {
                    text: `${nomeCliente} eu sou o Dior, Designer e vou cuidar da arte do pedido que você fez lá na ${nomeEmpresa} ok?\nAssim que der, entre no grupo abaixo que criei só pra falar sobre esse pedido.\n\n${groupLink1}`
                }, { headers });
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) { console.error("Erro ao mandar PV Cliente:", e.message); }
        }

        // Mensagens diretas para a SUPERVISÃO
        if (numSupervisor) {
            try {
                // Mensagem 1 (Sobre o grupo do cliente)
                if (groupLink1) {
                    await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numSupervisor}/messages/text`, {
                        text: `Eu criei o grupo para o pedido ${titulo} e convidei o ${nomeCliente}. Se quiser reforçar o convite o link é ${groupLink1}`
                    }, { headers });
                    await new Promise(r => setTimeout(r, 1000));
                }
                
                // Mensagem 2 (Sobre o grupo interno)
                if (groupLinkInterno) {
                    await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numSupervisor}/messages/text`, {
                        text: `Se precisar falar só comigo, sem o cliente, sobre o pedido ${titulo} use esse grupo: ${groupLinkInterno}`
                    }, { headers });
                }
            } catch (e) { console.error("Erro ao mandar PV Supervisão:", e.message); }
        }

        console.log(`[CHATAPP] Automação concluída! Grupo 1: ${chatId1} | Grupo Interno: ${chatIdInterno}`);
        
        return { 
            chatId: chatId1, 
            groupLink: groupLink1,
            chatIdInterno: chatIdInterno,
            groupLinkInterno: groupLinkInterno
        };

    } catch (error) {
        const errData = error.response?.data || {};
        const errCode = errData.error?.code || "";

        // SE O ERRO FOR TOKEN INVÁLIDO E AINDA NÃO TENTAMOS O RETRY
        if ((errCode === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            console.warn("[CHATAPP] Token inválido detectado. Limpando cache e tentando novamente...");
            
            // Apaga o token bichado do banco
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => {});
            
            // Chama a função novamente forçando um novo token
            return await criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, nomeCliente, nomeEmpresa, false);
        }

        console.error("[CHATAPP FATAL ERROR]", JSON.stringify(errData, null, 2));
        return null;
    }
}

module.exports = { criarGrupoProducao, getChatAppToken };
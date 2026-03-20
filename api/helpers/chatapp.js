// /api/helpers/chatapp.js

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const CHATAPP_API = 'https://api.chatapp.online/v1';
const prisma = new PrismaClient();

// ─── Garante que a tabela de config existe ───────────────────────────────────
async function garantirTabelaConfig() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS system_config (
                chave TEXT PRIMARY KEY,
                valor TEXT,
                atualizado_em TIMESTAMPTZ DEFAULT NOW()
            )
        `);
    } catch (e) { /* já existe — ignora */ }
}

// ─── Busca o token do banco ──────────────────────────────────────────────────
async function getTokenFromDB() {
    try {
        await garantirTabelaConfig();
        const rows = await prisma.$queryRawUnsafe(
            `SELECT valor FROM system_config WHERE chave = 'chatapp_token' LIMIT 1`
        );

        if (rows.length === 0) return null;

        // RETIRADO O LIMITE DE 25 MINUTOS.
        // Vamos confiar no token. Se estiver expirado, a API dará erro 401
        // e o bloco catch lá embaixo deletará o token do banco automaticamente.
        return rows[0].valor;
    } catch (e) {
        console.error('[CHATAPP] Erro ao ler token do banco:', e.message);
        return null;
    }
}

// ─── Salva o token no banco ──────────────────────────────────────────────────
async function saveTokenToDB(token) {
    try {
        await prisma.$executeRawUnsafe(`
            INSERT INTO system_config (chave, valor, atualizado_em)
            VALUES ('chatapp_token', $1, NOW())
            ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()
        `, token);
    } catch (e) {
        console.error('[CHATAPP] Erro ao salvar token no banco:', e.message);
    }
}

// ─── Obtém um token válido (do banco ou via autenticação) ────────────────────
async function getChatAppToken() {
    // 1. Tenta usar token cached no banco
    const tokenDB = await getTokenFromDB();
    if (tokenDB) {
        console.log('[CHATAPP] Token reutilizado do banco.');
        return tokenDB;
    }

    // 2. Token inexistente — autentica
    try {
        console.log('[CHATAPP] Autenticando no ChatApp (Gerando NOVO token)...');
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });

        const token = response.data?.accessToken || response.data?.data?.accessToken;
        if (token) {
            await saveTokenToDB(token);
            console.log('[CHATAPP] Novo token obtido e salvo no banco.');
        }
        return token;
    } catch (error) {
        const errData = error.response?.data || error.message;
        console.error("[CHATAPP AUTH ERROR]", errData);
        return null;
    }
}

// ─── Formata telefone para padrão WhatsApp (como Número Inteiro) ─────────────
function formatarTelefone(telefone) {
    if (!telefone) return null;
    let limpo = telefone.toString().replace(/\D/g, '');

    // Adiciona o DDI (55) caso venha apenas com DDD e Número
    if (limpo.length === 10 || limpo.length === 11) {
        limpo = '55' + limpo;
    }

    // Se o número for muito curto para ser um celular válido, descarta
    if (limpo.length < 12) return null;

    // A API do ChatApp exige NUMBER, não String.
    return parseInt(limpo, 10);
}

// ─── Cria o grupo de produção no ChatApp ─────────────────────────────────────
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

        const participantsItems = [];
        if (numCliente) participantsItems.push({ value: numCliente });
        if (numSupervisor) participantsItems.push({ value: numSupervisor });

        if (participantsItems.length === 0) {
            console.error("[CHATAPP] Erro: Nenhum número de telefone válido fornecido.");
            return null;
        }

        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;

        const payloadGrupo = {
            type: "group",
            name: `Pedido: ${titulo}`.substring(0, 25), // Limite de 25 caracteres do WPP
            participantsType: "phone",
            participantsItems: participantsItems
        };

        const resGrupo = await axios.post(urlGroups, payloadGrupo, { headers });

        const gData = resGrupo.data?.data || resGrupo.data;
        const chatId = gData.id;
        const groupLink = gData.inviteLink || '';

        if (!chatId) {
            console.error("[CHATAPP] Erro ao criar grupo — chatId não retornado.");
            return null;
        }

        console.log(`[CHATAPP] Grupo criado com sucesso (chatId=${chatId}). Aguardando 3 segundos para propagar...`);

        // 🕒 DELAY DE 3 SEGUNDOS: Evita enviar a mensagem antes do grupo "nascer" no WhatsApp
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Enviar briefing para o grupo
        const urlMsg = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;

        await axios.post(urlMsg, {
            text: `🚀 *NOVO PEDIDO INICIADO*\n\n*Serviço:* ${titulo}\n\n*Briefing de Arte:* \n${briefing}\n\n---`
        }, { headers });

        console.log(`[CHATAPP] Briefing enviado com sucesso para o grupo!`);
        return { chatId, groupLink };

    } catch (error) {
        const errData = error.response?.data || error.message;
        console.error("--- [CHATAPP FATAL ERROR] ---", JSON.stringify(errData, null, 2));

        // Se o token realmente expirou (401), apaga do banco para forçar renovação no próximo uso.
        if (error.response?.status === 401) {
            await prisma.$executeRawUnsafe(
                `DELETE FROM system_config WHERE chave = 'chatapp_token'`
            ).catch(() => { });
            console.warn('[CHATAPP] Token expirado (401) removido do banco.');
        }

        return null;
    }
}

module.exports = { criarGrupoProducao, getChatAppToken };
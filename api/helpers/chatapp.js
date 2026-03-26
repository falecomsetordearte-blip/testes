// /api/helpers/chatapp.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const CHATAPP_API = 'https://api.chatapp.online/v1';
const prisma = new PrismaClient();

async function garantirTabelaConfig() {
    try {
        await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS system_config (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TIMESTAMPTZ DEFAULT NOW())`);
    } catch (e) {}
}

async function getChatAppToken(forceRefresh = false) {
    if (!forceRefresh) {
        try {
            await garantirTabelaConfig();
            const rows = await prisma.$queryRawUnsafe(`SELECT valor FROM system_config WHERE chave = 'chatapp_token' LIMIT 1`);
            if (rows.length > 0) return rows[0].valor;
        } catch (e) {}
    }

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
        return null;
    }
}

function formatarTelefone(telefone) {
    if (!telefone) return null;
    let limpo = telefone.toString().replace(/\D/g, '');
    if (limpo.length === 10 || limpo.length === 11) limpo = '55' + limpo;
    return limpo.length >= 12 ? parseInt(limpo, 10) : null;
}

// -------------------------------------------------------------
// 1. CRIAÇÃO DOS GRUPOS PARA QUEM TERCEIRIZA A ARTE
// -------------------------------------------------------------
async function criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, nomeCliente = 'Cliente', nomeEmpresa = 'nossa gráfica', retry = true) {
    const token = await getChatAppToken(!retry);
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

        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;
        
        // GRUPO 1
        const resGrupo1 = await axios.post(urlGroups, { type: "group", name: `Pedido: ${titulo}`.substring(0, 50), participantsType: "phone", participantsItems: participantsItems }, { headers });
        const chatId1 = resGrupo1.data?.data?.id || resGrupo1.data?.id;
        const groupLink1 = resGrupo1.data?.data?.inviteLink || resGrupo1.data?.inviteLink || '';
        await new Promise(r => setTimeout(r, 2000));
        if (chatId1) {
            await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId1}/messages/text`, { text: `🚀 *NOVO PEDIDO INICIADO*\n\n*Serviço:* ${titulo}\n\n*Briefing de Arte:* \n${briefing}\n\n---` }, { headers });
        }

        // GRUPO 2 (INTERNO)
        let chatIdInterno = null;
        let groupLinkInterno = '';
        if (numSupervisor) {
            const resGrupo2 = await axios.post(urlGroups, { type: "group", name: `${titulo} - Designer`.substring(0, 50), participantsType: "phone", participantsItems: [{ value: numSupervisor }] }, { headers });
            chatIdInterno = resGrupo2.data?.data?.id || resGrupo2.data?.id;
            groupLinkInterno = resGrupo2.data?.data?.inviteLink || resGrupo2.data?.inviteLink || '';
            await new Promise(r => setTimeout(r, 2000));
            if (chatIdInterno) {
                await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatIdInterno}/messages/text`, { text: `Nesse grupo aqui não tem o cliente. Se precisar falar só comigo sobre esse pedido use por aqui.` }, { headers });
            }
        }

        // PV CLIENTE E SUPERVISÃO
        if (numCliente && groupLink1) {
            try { await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numCliente}/messages/text`, { text: `${nomeCliente} eu sou o Dior, Designer e vou cuidar da arte do pedido que você fez lá na ${nomeEmpresa} ok?\nAssim que der, entre no grupo abaixo que criei só pra falar sobre esse pedido.\n\n${groupLink1}` }, { headers }); await new Promise(r => setTimeout(r, 1000)); } catch (e) {}
        }
        if (numSupervisor) {
            try {
                if (groupLink1) { await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numSupervisor}/messages/text`, { text: `Eu criei o grupo para o pedido ${titulo} e convidei o ${nomeCliente}. Se quiser reforçar o convite o link é ${groupLink1}` }, { headers }); await new Promise(r => setTimeout(r, 1000)); }
                if (groupLinkInterno) await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numSupervisor}/messages/text`, { text: `Se precisar falar só comigo, sem o cliente, sobre o pedido ${titulo} use esse grupo: ${groupLinkInterno}` }, { headers });
            } catch (e) {}
        }

        return { chatId: chatId1, groupLink: groupLink1, chatIdInterno: chatIdInterno, groupLinkInterno: groupLinkInterno };

    } catch (error) {
        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => {});
            return await criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, nomeCliente, nomeEmpresa, false);
        }
        return null;
    }
}


// -------------------------------------------------------------
// 2. CRIAÇÃO DO GRUPO EXCLUSIVO DE ATUALIZAÇÕES
// -------------------------------------------------------------
async function criarGrupoNotificacoes(titulo, wppCliente, wppEmpresa, retry = true) {
    console.log(`[NOTIF-GROUP] Iniciando criação do grupo de notificações para o pedido: ${titulo}`);
    const token = await getChatAppToken(!retry);
    if (!token) {
        console.error(`[NOTIF-GROUP] Falha: Não foi possível obter token.`);
        return null;
    }

    const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
    const L_ID = process.env.CHATAPP_LICENSE_ID || '59808';
    const L_MSG = 'grWhatsApp';

    try {
        const numCliente = formatarTelefone(wppCliente);
        const numEmpresa = formatarTelefone(wppEmpresa);
        const participantsItems = [];

        if (numCliente) participantsItems.push({ value: numCliente });
        if (numEmpresa) participantsItems.push({ value: numEmpresa });
        
        if (participantsItems.length === 0) {
            console.error(`[NOTIF-GROUP] Falha: Cliente e Empresa sem números formatáveis.`);
            return null;
        }

        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;
        const resGrupo = await axios.post(urlGroups, {
            type: "group",
            name: `Pedido ${titulo} - Atualizações`.substring(0, 50),
            participantsType: "phone",
            participantsItems: participantsItems
        }, { headers });

        const chatId = resGrupo.data?.data?.id || resGrupo.data?.id;

        if (chatId) {
            console.log(`[NOTIF-GROUP] Grupo criado com ID: ${chatId}`);
            await new Promise(r => setTimeout(r, 2000));
            await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`, {
                text: `Olá! Criamos este grupo exclusivamente para enviar atualizações automáticas sobre as etapas do seu pedido.\n\nQualquer dúvida, fale com nosso atendimento: ${wppEmpresa || 'no privado'}`
            }, { headers });
        }

        return { chatId };
    } catch(error) {
        console.error(`[NOTIF-GROUP] ERRO na API:`, error.response?.data || error.message);
        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => {});
            return await criarGrupoNotificacoes(titulo, wppCliente, wppEmpresa, false);
        }
        return null;
    }
}


// -------------------------------------------------------------
// 3. ENVIAR MENSAGEM QUANDO O PEDIDO TROCAR DE ETAPA
// -------------------------------------------------------------
async function enviarNotificacaoEtapa(pedidoId, novaEtapa, retry = true) {
    console.log(`\n========================================`);
    console.log(`[ETAPA] Disparada notificação. ID: ${pedidoId} | Nova Etapa: ${novaEtapa}`);
    
    const token = await getChatAppToken(!retry);
    if (!token) {
        console.log(`[ETAPA-ABORT] Sem token válido.`);
        return false;
    }

    try {
        // 1. Busca dados do Pedido e da Empresa
        const pedidos = await prisma.$queryRawUnsafe(`SELECT empresa_id, notificar_cliente, chatapp_chat_notificacoes_id, nome_cliente FROM pedidos WHERE id = $1`, Number(pedidoId));
        
        console.log(`[ETAPA-DB] Resultado da busca do pedido no DB:`, pedidos[0] || 'NÃO ENCONTRADO');

        if (!pedidos.length) {
            console.log(`[ETAPA-ABORT] Pedido não encontrado no banco de dados.`);
            return false;
        }

        if (pedidos[0].notificar_cliente === false) {
            console.log(`[ETAPA-ABORT] Pedido está com 'notificar_cliente' falso.`);
            return false;
        }

        if (!pedidos[0].chatapp_chat_notificacoes_id) {
            console.log(`[ETAPA-ABORT] Pedido sem ID de Chat do grupo. (Provavelmente um pedido antigo criado antes dessa feature).`);
            return false;
        }

        const p = pedidos[0];

        // 2. Pega as configurações personalizadas daquela empresa específica
        const configs = await prisma.$queryRawUnsafe(`SELECT mensagens_etapas FROM painel_configuracoes_sistema WHERE empresa_id = $1`, p.empresa_id);
        const empresas = await prisma.$queryRawUnsafe(`SELECT whatsapp FROM empresas WHERE id = $1`, p.empresa_id);
        
        let mensagens = configs.length && configs[0].mensagens_etapas ? configs[0].mensagens_etapas : {};
        if (typeof mensagens === 'string') mensagens = JSON.parse(mensagens);

        console.log(`[ETAPA-CONFIGS] Mensagens capturadas do admin:`, Object.keys(mensagens));

        // 3. Mapeia a nova etapa com a CHAVE salva no banco
        let key = novaEtapa.toUpperCase().replace(' ', '_').replace('Ç', 'C').replace('Ã', 'A'); 
        if(novaEtapa === 'Instalação na Loja') key = 'INSTALACAO_LOJA';
        if(novaEtapa === 'Instalação Externa') key = 'INSTALACAO_EXTERNA';
        if(novaEtapa === 'Expedição') key = 'EXPEDICAO';
        if(novaEtapa === 'Impressão') key = 'IMPRESSAO';
        if(novaEtapa === 'Acabamento') key = 'ACABAMENTO';
        if(novaEtapa === 'Arte') key = 'ARTE';

        const msgBase = mensagens[key] || `Seu pedido avançou para a etapa: ${novaEtapa}. Nossa equipe cuidará de tudo para você!`;
        const numeroEmpresa = empresas.length ? empresas[0].whatsapp : '';

        // 4. Concatena a mensagem com a obrigação de "Fale conosco"
        const textoFinal = `Olá ${p.nome_cliente || ''}!\n\n${msgBase}\n\n*Dúvidas? Falar com nosso atendimento:* ${numeroEmpresa}`;

        // 5. Envia no Chat do Grupo
        const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
        const L_ID = process.env.CHATAPP_LICENSE_ID || '59808'; 
        const L_MSG = 'grWhatsApp'; 
        const url = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${p.chatapp_chat_notificacoes_id}/messages/text`;

        console.log(`[ETAPA-ENVIO] Disparando para API da ChatApp...`);
        const result = await axios.post(url, { text: textoFinal }, { headers });
        
        console.log(`[ETAPA-SUCESSO] Mensagem da etapa ${novaEtapa} ENVIADA! ID Mensagem:`, result.data?.data?.id || result.data?.id);
        return true;

    } catch (error) {
        console.error(`[ETAPA-ERRO] Erro na API do ChatApp:`, error.response?.data || error.message);
        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            console.log(`[ETAPA-RETRY] Token vencido, renovando e tentando novamente...`);
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => {});
            return await enviarNotificacaoEtapa(pedidoId, novaEtapa, false);
        }
        return false;
    }
}

module.exports = { criarGrupoProducao, criarGrupoNotificacoes, enviarNotificacaoEtapa, getChatAppToken };
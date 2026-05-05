// /api/helpers/chatapp.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const CHATAPP_API = 'https://api.chatapp.online/v1';
const prisma = new PrismaClient();

async function garantirTabelaConfig() {
    try {
        await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS system_config (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TIMESTAMPTZ DEFAULT NOW())`);
    } catch (e) {
        console.error('[CHATAPP-DB] Erro ao garantir tabela de configs:', e.message);
    }
}

async function getChatAppToken(forceRefresh = false) {
    if (!forceRefresh) {
        try {
            await garantirTabelaConfig();
            const rows = await prisma.$queryRawUnsafe(`SELECT valor FROM system_config WHERE chave = 'chatapp_token' LIMIT 1`);
            if (rows.length > 0) {
                console.log('[CHATAPP-TOKEN] Token recuperado do banco de dados.');
                return rows[0].valor;
            }
        } catch (e) {
            console.error('[CHATAPP-TOKEN] Erro ao buscar token do DB:', e.message);
        }
    }

    try {
        console.log('[CHATAPP-TOKEN] Autenticando para obter NOVO token...');
        const response = await axios.post(`${CHATAPP_API}/tokens`, {
            email: process.env.CHATAPP_EMAIL,
            password: process.env.CHATAPP_PASSWORD,
            appId: process.env.CHATAPP_APP_ID
        });

        const token = response.data?.accessToken || response.data?.data?.accessToken;
        if (token) {
            console.log('[CHATAPP-TOKEN] Novo token obtido com sucesso. Salvando no banco...');
            await prisma.$executeRawUnsafe(`
                INSERT INTO system_config (chave, valor, atualizado_em) VALUES ('chatapp_token', $1, NOW())
                ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()
            `, token);
            return token;
        }
        console.error('[CHATAPP-TOKEN] Resposta não continha accessToken:', response.data);
        return null;
    } catch (error) {
        console.error('[CHATAPP-TOKEN] Erro ao obter token da API:', error.response?.data || error.message);
        return null;
    }
}

function formatarTelefone(telefone) {
    if (!telefone) return null;
    let limpo = telefone.toString().replace(/\D/g, '');
    if (limpo.length === 10 || limpo.length === 11) limpo = '55' + limpo;
    return limpo.length >= 12 ? parseInt(limpo, 10) : null;
}

async function getLicenseId(empresaId) {
    let licenseId = process.env.CHATAPP_LICENSE_ID || '59808';
    if (!empresaId) return licenseId;
    
    try {
        const empresas = await prisma.$queryRawUnsafe(`SELECT chatapp_plano, chatapp_status, chatapp_license_id FROM empresas WHERE id = $1 LIMIT 1`, Number(empresaId));
        if (empresas.length > 0) {
            const e = empresas[0];
            if (e.chatapp_plano === 'PREMIUM' && e.chatapp_status === 'CONECTADO' && e.chatapp_license_id) {
                console.log(`[CHATAPP-LICENSE] Usando linha própria da empresa ${empresaId}: ${e.chatapp_license_id}`);
                return e.chatapp_license_id;
            }
        }
    } catch(err) {
        console.error('[CHATAPP-LICENSE] Erro ao buscar licença da empresa:', err.message);
    }
    return licenseId;
}

// -------------------------------------------------------------
// 1. CRIAÇÃO DOS GRUPOS PARA QUEM TERCEIRIZA A ARTE
// -------------------------------------------------------------
async function criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, nomeCliente = 'Cliente', nomeEmpresa = 'nossa gráfica', retry = true, empresaId = null) {
    console.log(`[CHATAPP-PRODUCAO] Iniciando criarGrupoProducao - Titulo: ${titulo}`);

    // Log para verificar se o link do Drive chegou dentro do briefing
    console.log(`[CHATAPP-PRODUCAO] Briefing recebido para o grupo: \n"${briefing}"`);

    const token = await getChatAppToken(!retry);
    if (!token) {
        console.error('[CHATAPP-PRODUCAO] Falha ao obter token. Abortando.');
        return null;
    }

    const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
    const L_ID = await getLicenseId(empresaId);
    const L_MSG = 'grWhatsApp';

    try {
        const numCliente = formatarTelefone(wppCliente);
        const numSupervisor = formatarTelefone(supervisorWpp);
        const participantsItems = [];

        console.log(`[CHATAPP-PRODUCAO] Wpp Cliente original: ${wppCliente} | Formatado: ${numCliente}`);
        console.log(`[CHATAPP-PRODUCAO] Wpp Supervisor original: ${supervisorWpp} | Formatado: ${numSupervisor}`);

        if (numCliente) participantsItems.push({ value: numCliente });
        if (numSupervisor) participantsItems.push({ value: numSupervisor });

        if (participantsItems.length === 0) {
            console.warn('[CHATAPP-PRODUCAO] Nenhum número válido para adicionar ao grupo.');
            return null;
        }

        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;

        // GRUPO 1
        console.log(`[CHATAPP-PRODUCAO] Requisitando criação do GRUPO 1 com participantes:`, participantsItems);
        const resGrupo1 = await axios.post(urlGroups, {
            type: "group",
            name: `Pedido: ${titulo}`.substring(0, 50),
            participantsType: "phone",
            participantsItems: participantsItems
        }, { headers });

        const chatId1 = resGrupo1.data?.data?.id || resGrupo1.data?.id;
        const groupLink1 = resGrupo1.data?.data?.inviteLink || resGrupo1.data?.inviteLink || '';
        console.log(`[CHATAPP-PRODUCAO] GRUPO 1 criado. ID: ${chatId1} | Link: ${groupLink1}`);

        await new Promise(r => setTimeout(r, 2000));

        if (chatId1) {
            console.log(`[CHATAPP-PRODUCAO] Enviando briefing inicial no GRUPO 1...`);
            const textoMensagem = `🚀 *NOVO PEDIDO INICIADO*\n\n*Serviço:* ${titulo}\n\n*Briefing de Arte:* \n${briefing}\n\n---`;

            await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId1}/messages/text`, {
                text: textoMensagem
            }, { headers });

            console.log(`[CHATAPP-PRODUCAO] Briefing enviado com sucesso no GRUPO 1.`);
        }

        // GRUPO 2 (INTERNO)
        let chatIdInterno = null;
        let groupLinkInterno = '';
        if (numSupervisor) {
            console.log(`[CHATAPP-PRODUCAO] Requisitando criação do GRUPO INTERNO com participante:`, numSupervisor);
            const resGrupo2 = await axios.post(urlGroups, {
                type: "group",
                name: `${titulo} - Designer`.substring(0, 50),
                participantsType: "phone",
                participantsItems: [{ value: numSupervisor }]
            }, { headers });

            chatIdInterno = resGrupo2.data?.data?.id || resGrupo2.data?.id;
            groupLinkInterno = resGrupo2.data?.data?.inviteLink || resGrupo2.data?.inviteLink || '';
            console.log(`[CHATAPP-PRODUCAO] GRUPO INTERNO criado. ID: ${chatIdInterno} | Link: ${groupLinkInterno}`);

            await new Promise(r => setTimeout(r, 2000));
            if (chatIdInterno) {
                console.log(`[CHATAPP-PRODUCAO] Enviando mensagem inicial no GRUPO INTERNO...`);
                await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatIdInterno}/messages/text`, {
                    text: `Nesse grupo aqui não tem o cliente. Se precisar falar só comigo sobre esse pedido use por aqui.`
                }, { headers });
            }
        }

        // PV CLIENTE E SUPERVISÃO
        if (numCliente && groupLink1) {
            console.log(`[CHATAPP-PRODUCAO] Enviando mensagem privada para o cliente: ${numCliente}`);
            try {
                await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numCliente}/messages/text`, {
                    text: `${nomeCliente} eu sou o Dior, Designer e vou cuidar da arte do pedido que você fez lá na ${nomeEmpresa} ok?\nAssim que der, entre no grupo abaixo que criei só pra falar sobre esse pedido.\n\n${groupLink1}`
                }, { headers });
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.error(`[CHATAPP-PRODUCAO] Erro ao enviar PV cliente:`, e.response?.data || e.message);
            }
        }
        if (numSupervisor) {
            console.log(`[CHATAPP-PRODUCAO] Enviando mensagens privadas para o supervisor: ${numSupervisor}`);
            try {
                if (groupLink1) {
                    await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numSupervisor}/messages/text`, {
                        text: `Eu criei o grupo para o pedido ${titulo} e convidei o ${nomeCliente}. Se quiser reforçar o convite o link é ${groupLink1}`
                    }, { headers });
                    await new Promise(r => setTimeout(r, 1000));
                }
                if (groupLinkInterno) {
                    await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numSupervisor}/messages/text`, {
                        text: `Se precisar falar só comigo, sem o cliente, sobre o pedido ${titulo} use esse grupo: ${groupLinkInterno}`
                    }, { headers });
                }
            } catch (e) {
                console.error(`[CHATAPP-PRODUCAO] Erro ao enviar PV supervisor:`, e.response?.data || e.message);
            }
        }

        console.log(`[CHATAPP-PRODUCAO] Finalizado com sucesso.`);
        return { chatId: chatId1, groupLink: groupLink1, chatIdInterno: chatIdInterno, groupLinkInterno: groupLinkInterno };

    } catch (error) {
        console.error(`[CHATAPP-PRODUCAO] ERRO na API:`, error.response?.data || error.message);
        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            console.log(`[CHATAPP-PRODUCAO] Token inválido. Tentando novamente com novo token...`);
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => { });
            return await criarGrupoProducao(titulo, wppCliente, supervisorWpp, briefing, nomeCliente, nomeEmpresa, false, empresaId);
        }
        return null;
    }
}


// -------------------------------------------------------------
// 2. CRIAÇÃO DO GRUPO EXCLUSIVO DE ATUALIZAÇÕES
// -------------------------------------------------------------
async function criarGrupoNotificacoes(titulo, wppCliente, wppEmpresa, nomeCliente = 'Cliente', nomeEmpresa = 'nossa gráfica', retry = true, empresaId = null) {
    console.log(`[NOTIF-GROUP] Iniciando criação do grupo de notificações para o pedido: ${titulo}`);
    const token = await getChatAppToken(!retry);
    if (!token) {
        console.error(`[NOTIF-GROUP] Falha: Não foi possível obter token.`);
        return null;
    }

    const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
    const L_ID = await getLicenseId(empresaId);
    const L_MSG = 'grWhatsApp';

    try {
        const numCliente = formatarTelefone(wppCliente);
        const numEmpresa = formatarTelefone(wppEmpresa);
        const participantsItems = [];

        console.log(`[NOTIF-GROUP] Wpp Cliente: ${wppCliente} -> ${numCliente}`);
        console.log(`[NOTIF-GROUP] Wpp Empresa: ${wppEmpresa} -> ${numEmpresa}`);

        if (numCliente) participantsItems.push({ value: numCliente });
        if (numEmpresa) participantsItems.push({ value: numEmpresa });

        if (participantsItems.length === 0) {
            console.error(`[NOTIF-GROUP] Falha: Cliente e Empresa sem números formatáveis.`);
            return null;
        }

        console.log(`[NOTIF-GROUP] Requisitando criação do grupo com participantes:`, participantsItems);
        const urlGroups = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats`;
        const resGrupo = await axios.post(urlGroups, {
            type: "group",
            name: `Pedido ${titulo} - Atualizações`.substring(0, 50),
            participantsType: "phone",
            participantsItems: participantsItems
        }, { headers });

        const chatId = resGrupo.data?.data?.id || resGrupo.data?.id;
        const groupLink = resGrupo.data?.data?.inviteLink || resGrupo.data?.inviteLink || '';

        if (chatId) {
            console.log(`[NOTIF-GROUP] Grupo criado com ID: ${chatId} | Link: ${groupLink}`);
            await new Promise(r => setTimeout(r, 2000));
            console.log(`[NOTIF-GROUP] Enviando mensagem de boas vindas no grupo ${chatId}...`);
            await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`, {
                text: `Olá! Criamos este grupo exclusivamente para enviar atualizações automáticas sobre as etapas do seu pedido.\n\nQualquer dúvida, fale com nosso atendimento: ${wppEmpresa || 'no privado'}`
            }, { headers });

            // ENVIAR MENSAGEM NO PV DO CLIENTE AVISANDO SOBRE O GRUPO
            if (numCliente && groupLink) {
                console.log(`[NOTIF-GROUP] Enviando PV do link de atualizações para o cliente...`);
                try {
                    await axios.post(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${numCliente}/messages/text`, {
                        text: `Olá, ${nomeCliente}!\nSeu pedido na ${nomeEmpresa} acabou de ser iniciado.\n\nPara acompanhar o andamento em tempo real e receber notificações de cada etapa concluída, clique no link abaixo para entrar no seu Grupo Exclusivo de Atualizações:\n\n${groupLink}\n\n*Dúvidas? Chamar no contato do atendimento: ${wppEmpresa || '(Não informado)'}*`
                    }, { headers });
                } catch (e) {
                    console.error(`[NOTIF-GROUP] Erro ao enviar PV cliente com o link de atualização:`, e.response?.data || e.message);
                }
            }
        } else {
            console.error(`[NOTIF-GROUP] Resposta da API não continha ID do grupo:`, resGrupo.data);
        }

        return { chatId, groupLink };
    } catch (error) {
        console.error(`[NOTIF-GROUP] ERRO na API:`, error.response?.data || error.message);
        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            console.log(`[NOTIF-GROUP] Token inválido. Tentando novamente com novo token...`);
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => { });
            return await criarGrupoNotificacoes(titulo, wppCliente, wppEmpresa, nomeCliente, nomeEmpresa, false, empresaId);
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
        console.error(`[ETAPA-ABORT] Sem token válido.`);
        return false;
    }

    try {
        // 1. Busca dados do Pedido e da Empresa
        console.log(`[ETAPA-DB] Buscando dados do pedido ${pedidoId}...`);
        const pedidos = await prisma.$queryRawUnsafe(`SELECT empresa_id, notificar_cliente, chatapp_chat_notificacoes_id, nome_cliente FROM pedidos WHERE id = $1`, Number(pedidoId));

        console.log(`[ETAPA-DB] Resultado da busca do pedido no DB:`, pedidos[0] || 'NÃO ENCONTRADO');

        if (!pedidos.length) {
            console.warn(`[ETAPA-ABORT] Pedido não encontrado no banco de dados.`);
            return false;
        }

        if (pedidos[0].notificar_cliente === false) {
            console.log(`[ETAPA-ABORT] Pedido está com 'notificar_cliente' falso.`);
            return false;
        }

        if (!pedidos[0].chatapp_chat_notificacoes_id) {
            console.warn(`[ETAPA-ABORT] Pedido sem ID de Chat do grupo de notificações.`);
            return false;
        }

        const p = pedidos[0];

        // 2. Pega as configurações personalizadas daquela empresa específica
        console.log(`[ETAPA-DB] Buscando configurações de notificação para a empresa ${p.empresa_id}...`);
        const configs = await prisma.$queryRawUnsafe(`SELECT mensagens_etapas FROM painel_configuracoes_sistema WHERE empresa_id = $1`, p.empresa_id);
        const empresas = await prisma.$queryRawUnsafe(`SELECT whatsapp, chatapp_plano, chatapp_status, chatapp_license_id FROM empresas WHERE id = $1`, p.empresa_id);

        let mensagens = configs.length && configs[0].mensagens_etapas ? configs[0].mensagens_etapas : {};
        if (typeof mensagens === 'string') mensagens = JSON.parse(mensagens);

        console.log(`[ETAPA-CONFIGS] Mensagens capturadas do admin:`, Object.keys(mensagens));

        // 3. Mapeia a nova etapa com a CHAVE salva no banco
        let key = novaEtapa.toUpperCase().replace(' ', '_').replace('Ç', 'C').replace('Ã', 'A');
        if (novaEtapa === 'Instalação na Loja') key = 'INSTALACAO_LOJA';
        if (novaEtapa === 'Instalação Externa') key = 'INSTALACAO_EXTERNA';
        if (novaEtapa === 'Expedição') key = 'EXPEDICAO';
        if (novaEtapa === 'Impressão') key = 'IMPRESSAO';
        if (novaEtapa === 'Acabamento') key = 'ACABAMENTO';
        if (novaEtapa === 'Arte') key = 'ARTE';

        const msgBase = mensagens[key] || `Seu pedido avançou para a etapa: ${novaEtapa}. Nossa equipe cuidará de tudo para você!`;
        const numeroEmpresa = empresas.length ? empresas[0].whatsapp : '';

        // 4. Concatena a mensagem com a obrigação de "Fale conosco"
        const textoFinal = `Olá ${p.nome_cliente || ''}!\n\n${msgBase}\n\n*Dúvidas? Falar com nosso atendimento:* ${numeroEmpresa}`;

        // 5. Envia no Chat do Grupo
        const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
        const L_ID = await getLicenseId(p.empresa_id);
        const L_MSG = 'grWhatsApp';
        const url = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${p.chatapp_chat_notificacoes_id}/messages/text`;

        console.log(`[ETAPA-ENVIO] Disparando mensagem para API da ChatApp...`);
        const result = await axios.post(url, { text: textoFinal }, { headers });

        console.log(`[ETAPA-SUCESSO] Mensagem da etapa ${novaEtapa} ENVIADA! ID Mensagem:`, result.data?.data?.id || result.data?.id);
        return true;

    } catch (error) {
        console.error(`[ETAPA-ERRO] Erro na API do ChatApp:`, error.response?.data || error.message);
        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            console.log(`[ETAPA-RETRY] Token vencido, renovando e tentando novamente...`);
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => { });
            return await enviarNotificacaoEtapa(pedidoId, novaEtapa, false);
        }
        return false;
    }
}

async function definirAvatarGrupo(chatId, url, retry = true, empresaId = null) {
    if (!chatId || !url || !url.startsWith('http')) return;
    
    // Pequeno delay para garantir que o grupo recém-criado já esteja propagado nos servidores da ChatApp
    await new Promise(r => setTimeout(r, 3000));

    console.log(`[CHATAPP-AVATAR] Baixando a imagem do link para conversão em formato Base64: ${url}`);
    let base64ImageString = '';
    
    try {
        const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
        const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';
        const base64Data = Buffer.from(imageResponse.data).toString('base64');
        base64ImageString = `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
        console.error(`[CHATAPP-AVATAR] Erro ao tentar baixar a imagem da url. Interrompendo upload do avatar. Detalhe:`, error.message);
        return; // Retorna pois sem imagem formatada não é possível atualizar o grupo
    }

    console.log(`[CHATAPP-AVATAR] Sucesso na conversão da imagem. Definindo avatar para o chat ID: ${chatId}...`);
    const token = await getChatAppToken(!retry);
    if (!token) return;

    const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
    const L_ID = await getLicenseId(empresaId);
    const L_MSG = 'grWhatsApp';

    const encodedId = encodeURIComponent(chatId);

    try {
        // Envia requisição PATCH para a raiz do chat, atualizando o campo 'imageDetail' com o Base64
        await axios.patch(`${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${encodedId}`, {
            imageDetail: base64ImageString
        }, { headers });
        
        console.log(`[CHATAPP-AVATAR] Avatar atualizado com sucesso via método PATCH /chats!`);
    } catch (error) {
        console.error(`[CHATAPP-AVATAR] Erro ao atualizar o avatar via API ChatApp:`, error.response?.data || error.message);

        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            console.log(`[CHATAPP-AVATAR] Token inválido reportado. Limpando cache e tentando novamente...`);
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => { });
            return await definirAvatarGrupo(chatId, url, false, empresaId);
        }
    }
}

async function enviarMensagemTexto(chatId, texto, retry = true, empresaId = null) {
    if (!chatId || !texto) return null;

    const token = await getChatAppToken(!retry);
    if (!token) return null;

    const headers = { 'Authorization': token, 'Content-Type': 'application/json', 'Lang': 'pt' };
    const L_ID = await getLicenseId(empresaId);
    const L_MSG = 'grWhatsApp';

    try {
        const url = `${CHATAPP_API}/licenses/${L_ID}/messengers/${L_MSG}/chats/${chatId}/messages/text`;
        const result = await axios.post(url, { text: texto }, { headers });
        return result.data;
    } catch (error) {
        console.error(`[CHATAPP-SEND] Erro ao enviar mensagem de texto:`, error.response?.data || error.message);
        if ((error.response?.data?.error?.code === "ApiInvalidTokenError" || error.response?.status === 401) && retry) {
            await prisma.$executeRawUnsafe(`DELETE FROM system_config WHERE chave = 'chatapp_token'`).catch(() => { });
            return await enviarMensagemTexto(chatId, texto, false, empresaId);
        }
        return null;
    }
}

module.exports = { 
    criarGrupoProducao, 
    criarGrupoNotificacoes, 
    enviarNotificacaoEtapa, 
    getChatAppToken, 
    definirAvatarGrupo,
    enviarMensagemTexto,
    getLicenseId
};
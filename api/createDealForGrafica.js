// /api/createDealForGrafica.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { criarGrupoProducao, criarGrupoNotificacoes, definirAvatarGrupo } = require('./helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    console.log("--- [DEBUG] INICIANDO REQUISIÇÃO DE PEDIDO ---");

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, notificarCliente, ...formData } = req.body;

        // Log para ver se o token está chegando do frontend
        console.log(`[DEBUG] Token Recebido: "${sessionToken ? sessionToken.substring(0, 15) + '...' : 'NULL'}"`);

        // Log para investigar TODAS as variáveis que o frontend está mandando
        console.log(`[DEBUG] Dados brutos recebidos (formData):`, JSON.stringify(formData));

        // 1. Identificar Empresa
        const empresas = await prisma.$queryRawUnsafe(
            `SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`,
            `%${sessionToken}%`
        );

        if (empresas.length === 0) {
            console.error(`[ERRO] Empresa não encontrada. Token enviado: ${sessionToken}`);
            return res.status(403).json({ message: 'Sessão inválida. Tente fazer login novamente.' });
        }

        const empresa = empresas[0];
        console.log(`[OK] Empresa Identificada: ${empresa.nome_fantasia || empresa.nome || empresa.id}`);

        // 2. Normalizar a checagem da ARTE
        const arteNormalizada = arte ? arte.trim().toLowerCase() : "";
        console.log(`[DEBUG] Arte selecionada: "${arte}" (Normalizada: "${arteNormalizada}")`);

        let etapaDestino = (arteNormalizada === 'arquivo do cliente') ? 'IMPRESSÃO' : 'ARTE';

        // Normaliza a busca do link (pega de qualquer variação que o frontend possa enviar)
        const linkParaAnexo = formData.linkArquivoDrive || formData.linkArquivo || formData.linkDrive || formData.link || null;
        console.log(`[DEBUG] Link de anexo identificado: ${linkParaAnexo ? linkParaAnexo : 'NENHUM LINK ENCONTRADO'}`);

        // Montando o Briefing Final
        let briefingFinal = `${formData.briefingFormatado || 'Sem briefing'}\n\nEntrega: ${tipoEntrega ? tipoEntrega.toUpperCase() : 'NÃO INFORMADA'}`;

        if (linkParaAnexo) {
            briefingFinal += `\n\n📎 Arquivos de Referência: ${linkParaAnexo}`;
            console.log(`[DEBUG] Link de anexo injetado no briefing com sucesso.`);
        }

        const valorParaSalvar = parseFloat(valorDesigner || 0);

        // Se não vier especificado, o padrão é SIM (true)
        const deveNotificar = notificarCliente !== false;

        console.log(`[DEBUG] Etapa Destino: ${etapaDestino} | Valor Designer: ${valorParaSalvar} | Deve Notificar: ${deveNotificar}`);

        // 3. Inserir Pedido no Banco
        console.log(`[DEBUG] Inserindo pedido no banco de dados...`);
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (
                empresa_id, titulo, nome_cliente, whatsapp_cliente, 
                servico, tipo_arte, briefing_completo, etapa, 
                valor_designer, link_arquivo_impressao, notificar_cliente, created_at, bitrix_deal_id
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 0)
            RETURNING id
        `,
            empresa.id,
            formData.titulo || 'Sem Título',
            formData.nomeCliente || 'Sem Nome',
            formData.wppCliente || '',
            formData.servico || '',
            arte,
            briefingFinal,
            etapaDestino,
            valorParaSalvar,
            linkParaAnexo, // Usamos a variável normalizada aqui também
            deveNotificar
        );

        const newPedidoId = insertResult[0].id;
        console.log(`[OK] Pedido salvo com Sucesso! ID: ${newPedidoId}`);

        // --- 4. BLOCO DE AUTOMAÇÃO CHATAPP (SETOR DE ARTE) ---
        if (arteNormalizada.includes("setor") && arteNormalizada.includes("arte")) {
            console.log(`[CHATAPP] Iniciando criação de grupo duplo (Produção)...`);
            try {
                const automacao = await criarGrupoProducao(
                    formData.titulo,
                    formData.wppCliente,
                    supervisaoWpp,
                    briefingFinal, // O link anexado já vai dentro desta variável
                    formData.nomeCliente || 'Cliente',
                    empresa.nome_fantasia || 'nossa gráfica'
                );

                if (automacao && automacao.chatId) {
                    console.log(`[CHATAPP] Grupos criados. Vinculando IDs ao pedido ${newPedidoId}...`);
                    await prisma.$executeRawUnsafe(`
                        UPDATE pedidos 
                        SET chatapp_chat_id = $1, 
                            link_acompanhar = $2,
                            chatapp_chat_intern_id = $3
                        WHERE id = $4
                    `, automacao.chatId, automacao.groupLink, automacao.chatIdInterno, newPedidoId);
                    
                    // --- NOVA LÓGICA: DEFINIR AVATAR DO GRUPO ---
                    if (empresa.logo_id && empresa.logo_id.startsWith('http')) {
                        console.log(`[CHATAPP-AVATAR] Disparando atualização de foto de perfil...`);
                        await definirAvatarGrupo(automacao.chatId, empresa.logo_id);
                        if (automacao.chatIdInterno) {
                            await definirAvatarGrupo(automacao.chatIdInterno, empresa.logo_id);
                        }
                    }

                    console.log(`[CHATAPP] Grupos criados e vinculados! Cliente ID: ${automacao.chatId} | Interno ID: ${automacao.chatIdInterno}`);
                } else {
                    console.error(`[CHATAPP] FALHA: A função criarGrupoProducao não retornou um ID de chat. Verifique os logs do helper chatapp.js.`);
                }
            } catch (errAuto) {
                console.error("[CHATAPP] ERRO CRÍTICO NA FUNÇÃO DE GRUPO:", errAuto.message);
            }
        } else {
            console.log(`[CHATAPP] Ignorado grupo de produção: Arte não é 'Setor de Arte' (encontrado: '${arteNormalizada}').`);
        }

        // --- 4.5. BLOCO DE GRUPO DE NOTIFICAÇÕES (ATUALIZAÇÕES) ---
        if (deveNotificar && formData.wppCliente) {
            console.log(`[NOTIF-GROUP] Disparando criação do grupo de notificações para o WhatsApp: ${formData.wppCliente}`);
            try {
                const grupoNotif = await criarGrupoNotificacoes(
                    formData.titulo,
                    formData.wppCliente,
                    empresa.whatsapp,
                    formData.nomeCliente || 'Cliente',
                    empresa.nome_fantasia || 'nossa gráfica'
                );
                if (grupoNotif && grupoNotif.chatId) {
                    console.log(`[NOTIF-GROUP] Vinculando grupo de notificações ao pedido ${newPedidoId}...`);
                    await prisma.$executeRawUnsafe(`
                        UPDATE pedidos SET chatapp_chat_notificacoes_id = $1 WHERE id = $2
                    `, grupoNotif.chatId, newPedidoId);
                    
                    // --- NOVA LÓGICA: DEFINIR AVATAR DO GRUPO ---
                    if (empresa.logo_id && empresa.logo_id.startsWith('http')) {
                        await definirAvatarGrupo(grupoNotif.chatId, empresa.logo_id);
                    }

                    console.log(`[NOTIF-GROUP] Grupo de notificações vinculado com sucesso! ID: ${grupoNotif.chatId}`);
                } else {
                    console.error(`[NOTIF-GROUP] FALHA: Não retornou ID do grupo de notificações.`);
                }
            } catch (e) {
                console.error("[NOTIF-GROUP] Erro grupo notificações (exceção não tratada no helper):", e.message);
            }
        } else {
            console.log(`[NOTIF-GROUP] Ignorado. Cliente quer notificação? ${deveNotificar}. WppCliente preenchido? ${!!formData.wppCliente}`);
        }

        // 5. Lógica Financeira
        if (arteNormalizada.includes("setor") && valorParaSalvar > 0) {
            console.log(`[FINANCEIRO] Descontando valor de designer do saldo (R$ ${valorParaSalvar})...`);
            await prisma.$executeRawUnsafe(`UPDATE empresas SET saldo = saldo - $1 WHERE id = $2`, valorParaSalvar, empresa.id);
            await prisma.$executeRawUnsafe(`
                INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) 
                VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
            `, empresa.id, valorParaSalvar, String(newPedidoId), `Produção: ${formData.titulo}`);
            console.log(`[FINANCEIRO] Lógica financeira aplicada com sucesso.`);
        }

        console.log(`[OK] Processo de pedido finalizado com sucesso. Retornando dealId: ${newPedidoId}`);
        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        console.error("[ERRO GERAL NO ENDPOINT]:", error.message);
        console.error(error.stack);
        return res.status(500).json({ message: "Erro interno no servidor: " + error.message });
    } finally {
        await prisma.$disconnect();
    }
};
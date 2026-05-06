// /api/expedicao/entregar.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chatapp = require('../helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, id, pedirAvaliacaoGoogle } = req.body;
        if (!sessionToken || !id) return res.status(400).json({ message: 'Dados incompletos' });

        // 1. Identificar Empresa pelo Token
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) return res.status(403).json({ message: 'Sessão inválida' });

        // --- VALIDAÇÃO PRÉVIA: Se pediu avaliação, precisa ter config ---
        let configEmpresa = null;
        if (pedirAvaliacaoGoogle) {
            console.log(`[GOOGLE-REVIEW] Validando configurações para empresa ${empresaId}...`);
            const configs = await prisma.$queryRawUnsafe(`
                SELECT google_review_link, google_review_message FROM painel_configuracoes_sistema WHERE empresa_id = $1
            `, empresaId);

            if (configs.length === 0 || !configs[0].google_review_link || !configs[0].google_review_message) {
                console.warn(`[GOOGLE-REVIEW] Tentativa de envio sem configurações completas.`);
                return res.status(400).json({ 
                    message: 'Configurações de avaliação incompletas. Por favor, preencha o Link do Google e a Mensagem Padrão no menu Marketing para usar esta função.' 
                });
            }
            configEmpresa = configs[0];
        }

        // 2. Atualizar para Entregue e Mover etapa para CONCLUÍDO
        const resultado = await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET status_expedicao = 'Entregue', 
                etapa = 'CONCLUÍDO',
                updated_at = NOW() 
            WHERE id = $1 
            AND empresa_id = $2
        `, parseInt(id), empresaId);

        if (resultado === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou acesso negado.' });
        }

        // 3. Enviar mensagem do Google Review se solicitado
        if (pedirAvaliacaoGoogle && configEmpresa) {
            console.log(`[GOOGLE-REVIEW] Solicitação de avaliação detectada para o pedido ID: ${id}`);
            try {
                // Buscar dados do pedido para a mensagem
                const pedidos = await prisma.$queryRawUnsafe(`
                    SELECT nome_cliente, chatapp_chat_notificacoes_id FROM pedidos WHERE id = $1
                `, parseInt(id));

                if (pedidos.length > 0) {
                    const pedido = pedidos[0];
                    console.log(`[GOOGLE-REVIEW] Dados do pedido encontrados: Cliente=${pedido.nome_cliente}, ChatID=${pedido.chatapp_chat_notificacoes_id}`);
                    
                    if (pedido.chatapp_chat_notificacoes_id) {
                        console.log(`[GOOGLE-REVIEW] Preparando mensagem...`);
                        let textoMensagem = configEmpresa.google_review_message;
                        textoMensagem = textoMensagem.replace(/\[nome_cliente\]/gi, pedido.nome_cliente || '');
                        textoMensagem = textoMensagem.replace(/\[link_google\]/gi, configEmpresa.google_review_link);

                        console.log(`[GOOGLE-REVIEW] Texto final: ${textoMensagem.substring(0, 50)}...`);

                        const result = await chatapp.enviarMensagemTexto(
                            pedido.chatapp_chat_notificacoes_id,
                            textoMensagem,
                            true,
                            empresaId
                        );
                        console.log(`[GOOGLE-REVIEW] Resultado do envio:`, result ? 'Sucesso' : 'Falha');
                    } else {
                        console.warn(`[GOOGLE-REVIEW] Pedido ${id} não possui chatapp_chat_notificacoes_id.`);
                    }
                }
            } catch (errMsg) {
                console.error("[GOOGLE-REVIEW] Erro ao enviar Google Review:", errMsg);
            }
        } else if (!pedirAvaliacaoGoogle) {
            console.log(`[GOOGLE-REVIEW] Pedido finalizado sem solicitação de avaliação do Google.`);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro Expedição Entregar:", error);
        return res.status(500).json({ message: 'Erro ao atualizar status' });
    }
};
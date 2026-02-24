// /api/createDealForGrafica.js - VERSÃO COM LOGS AGRESSIVOS PARA AUTOMAÇÃO

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { criarGrupoProducao } = require('./helpers/chatapp'); // IMPORTA A AUTOMAÇÃO

module.exports = async (req, res) => {
    // Configurações de cabeçalho para evitar bloqueios de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    console.log("--- [DEBUG PEDIDO] Iniciando nova tentativa de criação ---");

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, ...formData } = req.body;

        // 1. Identificar Empresa no Neon
        console.log(`[DEBUG] Buscando empresa para o token: ${sessionToken ? sessionToken.substring(0, 8) + "..." : "AUSENTE"}`);
        const empresas = await prisma.$queryRawUnsafe(`SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        
        if (empresas.length === 0) {
            console.error("[DEBUG] Erro: Sessão inválida no banco Neon.");
            return res.status(403).json({ message: 'Sessão inválida.' });
        }
        const empresa = empresas[0];
        console.log(`[DEBUG] Empresa identificada: ${empresa.nome_fantasia} (ID: ${empresa.id})`);

        // 2. Definir regras de Etapa e Briefing
        let etapaDestino = (arte === 'Arquivo do Cliente') ? 'IMPRESSÃO' : 'ARTE';
        let briefingFinal = `${formData.briefingFormatado || 'Sem briefing'}\n\nEntrega: ${tipoEntrega ? tipoEntrega.toUpperCase() : 'NÃO INFORMADA'}`;

        // 3. Inserir o Pedido no Neon (para garantir que o ID exista antes da automação)
        console.log("[DEBUG] Gravando pedido inicial no Neon...");
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (
                empresa_id, titulo, nome_cliente, whatsapp_cliente, 
                servico, tipo_arte, briefing_completo, etapa, created_at, bitrix_deal_id
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 0)
            RETURNING id
        `, 
        empresa.id, 
        formData.titulo || 'Sem Título', 
        formData.nomeCliente || 'Sem Nome', 
        formData.wppCliente || '', 
        formData.servico || '', 
        arte, 
        briefingFinal, 
        etapaDestino
        );

        const newPedidoId = insertResult[0].id;
        console.log(`[DEBUG] Pedido gravado com Sucesso! ID Gerado no Neon: ${newPedidoId}`);

        // --- 4. BLOCO DE AUTOMAÇÃO CHATAPP (DETALHADO) ---
        if (arte === 'Setor de Arte') {
            console.log(">>> [AUTOMAÇÃO] Detectado Setor de Arte. Iniciando ChatApp...");
            
            if (!supervisaoWpp) {
                console.warn(">>> [AUTOMAÇÃO] Alerta: supervisaoWpp está VAZIO. Pulando criação de grupo.");
            } else {
                console.log(`>>> [AUTOMAÇÃO] Parâmetros para criarGrupoProducao: 
                    Título: ${formData.titulo}
                    Supervisor: ${supervisaoWpp}
                    Briefing Length: ${briefingFinal.length} caracteres`);

                try {
                    const automacao = await criarGrupoProducao(formData.titulo, supervisaoWpp, briefingFinal);
                    
                    if (automacao && automacao.chatId) {
                        console.log(`>>> [AUTOMAÇÃO] SUCESSO! ChatID: ${automacao.chatId} | Link: ${automacao.groupLink}`);
                        
                        await prisma.$executeRawUnsafe(`
                            UPDATE pedidos SET 
                                chatapp_chat_id = $1, 
                                link_acompanhar = $2 
                            WHERE id = $3
                        `, automacao.chatId, automacao.groupLink, newPedidoId);
                        
                        console.log(">>> [AUTOMAÇÃO] Neon atualizado com os links do WhatsApp.");
                    } else {
                        console.error(">>> [AUTOMAÇÃO] FALHA: O helper ChatApp retornou nulo ou incompleto.");
                    }
                } catch (errAuto) {
                    console.error(">>> [AUTOMAÇÃO] ERRO CRÍTICO na chamada da função ChatApp:", errAuto.message);
                }
            }
        } else {
            console.log("[DEBUG] Tipo de Arte não requer automação ChatApp (Arquivo Pronto ou Próprio).");
        }

        // 5. Lógica Financeira (Apenas se for Setor de Arte)
        if (arte === 'Setor de Arte' && parseFloat(valorDesigner || 0) > 0) {
            const custo = parseFloat(valorDesigner);
            console.log(`[DEBUG] Processando financeiro: R$ ${custo.toFixed(2)}`);
            
            await prisma.$executeRawUnsafe(`UPDATE empresas SET saldo = saldo - $1 WHERE id = $2`, custo, empresa.id);
            await prisma.$executeRawUnsafe(`
                INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) 
                VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
            `, empresa.id, custo, String(newPedidoId), `Produção: ${formData.titulo}`);
            
            console.log("[DEBUG] Saldo da empresa atualizado e histórico gravado.");
        }

        console.log("--- [DEBUG PEDIDO] Fluxo finalizado com sucesso ---");
        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        console.error("--- [ERRO FATAL NO CREATE DEAL] ---");
        console.error("Mensagem:", error.message);
        console.error("Stack:", error.stack);
        return res.status(500).json({ message: "Erro interno: " + error.message });
    }
};
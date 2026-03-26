// /api/createDealForGrafica.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { criarGrupoProducao } = require('./helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    console.log("--- [DEBUG] INICIANDO REQUISIÇÃO DE PEDIDO ---");

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, ...formData } = req.body;

        // Log para ver se o token está chegando do frontend
        console.log(`[DEBUG] Token Recebido: "${sessionToken ? sessionToken.substring(0, 15) + '...' : 'NULL'}"`);

        // 1. Identificar Empresa (Voltamos para o LIKE para garantir a compatibilidade)
        const empresas = await prisma.$queryRawUnsafe(
            `SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, 
            `%${sessionToken}%`
        );

        if (empresas.length === 0) {
            console.error(`[ERRO] Empresa não encontrada. Token enviado: ${sessionToken}`);
            return res.status(403).json({ message: 'Sessão inválida. Tente fazer login novamente.' });
        }
        
        const empresa = empresas[0];
        // Atualizado aqui para exibir o nome_fantasia no console
        console.log(`[OK] Empresa Identificada: ${empresa.nome_fantasia || empresa.id}`);

        // 2. Normalizar a checagem da ARTE
        const arteNormalizada = arte ? arte.trim().toLowerCase() : "";
        console.log(`[DEBUG] Arte selecionada: "${arte}"`);

        let etapaDestino = (arteNormalizada === 'arquivo do cliente') ? 'IMPRESSÃO' : 'ARTE';
        let briefingFinal = `${formData.briefingFormatado || 'Sem briefing'}\n\nEntrega: ${tipoEntrega ? tipoEntrega.toUpperCase() : 'NÃO INFORMADA'}`;

        if (formData.linkArquivoDrive) {
            briefingFinal += `\n\n📎 Arquivos de Referência: ${formData.linkArquivoDrive}`;
        }

        const valorParaSalvar = parseFloat(valorDesigner || 0);

        // 3. Inserir Pedido no Banco
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (
                empresa_id, titulo, nome_cliente, whatsapp_cliente, 
                servico, tipo_arte, briefing_completo, etapa, 
                valor_designer, link_arquivo_impressao, created_at, bitrix_deal_id
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 0)
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
            formData.linkArquivo || formData.linkArquivoDrive || null
        );

        const newPedidoId = insertResult[0].id;
        console.log(`[OK] Pedido salvo com Sucesso! ID: ${newPedidoId}`);

        // --- 4. BLOCO DE AUTOMAÇÃO CHATAPP ---
        // Condição: Se o texto da arte contiver "setor" e "arte" (independente de maiúsculas)
        if (arteNormalizada.includes("setor") && arteNormalizada.includes("arte")) {
            console.log(`[CHATAPP] Iniciando criação de grupo duplo...`);
            console.log(`[CHATAPP] Dados: Cliente=${formData.wppCliente} | Supervisor=${supervisaoWpp}`);

            try {
                // Adicionado nomeCliente e nomeEmpresa (usando empresa.nome_fantasia)
                const automacao = await criarGrupoProducao(
                    formData.titulo,
                    formData.wppCliente, 
                    supervisaoWpp,       
                    briefingFinal,
                    formData.nomeCliente || 'Cliente',
                    empresa.nome_fantasia || 'nossa gráfica' // <--- ALTERADO AQUI
                );

                if (automacao && automacao.chatId) {
                    await prisma.$executeRawUnsafe(`
                        UPDATE pedidos 
                        SET chatapp_chat_id = $1, 
                            link_acompanhar = $2,
                            chatapp_chat_intern_id = $3
                        WHERE id = $4
                    `, automacao.chatId, automacao.groupLink, automacao.chatIdInterno, newPedidoId);
                    console.log(`[CHATAPP] Grupos criados e vinculados! Cliente ID: ${automacao.chatId} | Interno ID: ${automacao.chatIdInterno}`);
                } else {
                    console.error(`[CHATAPP] FALHA: A função criarGrupoProducao não retornou um ID de chat.`);
                }
            } catch (errAuto) {
                console.error("[CHATAPP] ERRO CRÍTICO NA FUNÇÃO DE GRUPO:", errAuto.message);
            }
        } else {
            console.log(`[CHATAPP] Ignorado: Arte não é 'Setor de Arte'. (Valor: "${arte}")`);
        }

        // 5. Lógica Financeira
        if (arteNormalizada.includes("setor") && valorParaSalvar > 0) {
            await prisma.$executeRawUnsafe(`UPDATE empresas SET saldo = saldo - $1 WHERE id = $2`, valorParaSalvar, empresa.id);
            await prisma.$executeRawUnsafe(`
                INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) 
                VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
            `, empresa.id, valorParaSalvar, String(newPedidoId), `Produção: ${formData.titulo}`);
        }

        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        console.error("[ERRO GERAL NO ENDPOINT]:", error.message);
        return res.status(500).json({ message: "Erro interno no servidor: " + error.message });
    }
};
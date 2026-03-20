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

        // 1. Identificar Empresa
        const empresas = await prisma.$queryRawUnsafe(`SELECT * FROM empresas WHERE session_tokens = $1 LIMIT 1`, sessionToken);
        if (empresas.length === 0) {
            console.error("[ERRO] Empresa não encontrada para o token informado.");
            return res.status(403).json({ message: 'Sessão inválida.' });
        }
        const empresa = empresas[0];

        // 2. Normalizar a checagem da ARTE (Evita erro de maiúscula/minúscula)
        const arteNormalizada = arte ? arte.trim().toLowerCase() : "";
        console.log(`[DEBUG] Arte recebida: "${arte}" | Normalizada: "${arteNormalizada}"`);

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
        console.log(`[OK] Pedido salvo no banco. ID: ${newPedidoId}`);

        // --- 4. BLOCO DE AUTOMAÇÃO CHATAPP ---
        // Checagem flexível: se contiver "setor" e "arte", ele tenta criar o grupo
        if (arteNormalizada.includes("setor") && arteNormalizada.includes("arte")) {
            console.log(`[CHATAPP] Condição aceita. Tentando criar grupo...`);
            console.log(`[CHATAPP] Cliente: ${formData.wppCliente} | Supervisor: ${supervisaoWpp}`);

            try {
                const automacao = await criarGrupoProducao(
                    formData.titulo,
                    formData.wppCliente, 
                    supervisaoWpp,       
                    briefingFinal
                );

                if (automacao && automacao.chatId) {
                    await prisma.$executeRawUnsafe(`
                        UPDATE pedidos SET chatapp_chat_id = $1, link_acompanhar = $2 WHERE id = $3
                    `, automacao.chatId, automacao.groupLink, newPedidoId);
                    console.log(`[CHATAPP] SUCESSO: Grupo ${automacao.chatId} vinculado ao pedido.`);
                } else {
                    console.error(`[CHATAPP] FALHA: A função criarGrupoProducao retornou vazio.`);
                }
            } catch (errAuto) {
                console.error("[CHATAPP] ERRO FATAL NA AUTOMAÇÃO:", errAuto.message);
            }
        } else {
            console.log(`[CHATAPP] Ignorado. Motivo: arte="${arte}" não é 'Setor de Arte'`);
        }

        // 5. Financeiro
        if (arteNormalizada.includes("setor") && valorParaSalvar > 0) {
            await prisma.$executeRawUnsafe(`UPDATE empresas SET saldo = saldo - $1 WHERE id = $2`, valorParaSalvar, empresa.id);
            await prisma.$executeRawUnsafe(`
                INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) 
                VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
            `, empresa.id, valorParaSalvar, String(newPedidoId), `Produção: ${formData.titulo}`);
        }

        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        console.error("[ERRO GERAL]:", error.message);
        return res.status(500).json({ message: "Erro interno: " + error.message });
    }
};
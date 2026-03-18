// /api/createDealForGrafica.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { criarGrupoProducao } = require('./helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    console.log("--- [DEBUG PEDIDO] Iniciando nova tentativa de criação ---");

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, ...formData } = req.body;

        // 1. Identificar Empresa no Neon
        const empresas = await prisma.$queryRawUnsafe(`SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }
        const empresa = empresas[0];

        // 2. Definir regras de Etapa e Briefing
        let etapaDestino = (arte === 'Arquivo do Cliente') ? 'IMPRESSÃO' : 'ARTE';
        let briefingFinal = `${formData.briefingFormatado || 'Sem briefing'}\n\nEntrega: ${tipoEntrega ? tipoEntrega.toUpperCase() : 'NÃO INFORMADA'}`;

        // Tratamento do valor para garantir que seja número (evita salvar NULL se vier vazio)
        const valorParaSalvar = parseFloat(valorDesigner || 0);

        // 3. Inserir o Pedido no Neon (CORREÇÃO AQUI: ADICIONADO link_arquivo_impressao)
        console.log(`[DEBUG] Gravando pedido. Valor Designer: R$ ${valorParaSalvar}`);

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
            formData.linkArquivo || null // <--- $10: Agora salvamos o link de impressão correto
        );

        const newPedidoId = insertResult[0].id;
        console.log(`[DEBUG] Pedido gravado com Sucesso! ID: ${newPedidoId}`);

        // --- 4. BLOCO DE AUTOMAÇÃO CHATAPP ---
        if (arte === 'Setor de Arte') {
            try {
                const automacao = await criarGrupoProducao(
                    formData.titulo,
                    formData.wppCliente, // Número do Cliente
                    supervisaoWpp,       // Número do Supervisor
                    briefingFinal
                );

                if (automacao && automacao.chatId) {
                    await prisma.$executeRawUnsafe(`
                        UPDATE pedidos SET chatapp_chat_id = $1, link_acompanhar = $2 WHERE id = $3
                    `, automacao.chatId, automacao.groupLink, newPedidoId);
                }
            } catch (errAuto) {
                console.error(">>> [AUTOMAÇÃO] ERRO:", errAuto.message);
            }
        }

        // 5. Lógica Financeira (Débito na Empresa)
        if (arte === 'Setor de Arte' && valorParaSalvar > 0) {
            await prisma.$executeRawUnsafe(`UPDATE empresas SET saldo = saldo - $1 WHERE id = $2`, valorParaSalvar, empresa.id);
            await prisma.$executeRawUnsafe(`
                INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) 
                VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
            `, empresa.id, valorParaSalvar, String(newPedidoId), `Produção: ${formData.titulo}`);
        }

        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        console.error("Mensagem:", error.message);
        return res.status(500).json({ message: "Erro interno: " + error.message });
    }
};
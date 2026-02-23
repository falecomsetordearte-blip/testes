const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { criarGrupoProducao } = require('./helpers/chatapp'); // IMPORTA A AUTOMAÇÃO

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, ...formData } = req.body;

        const empresas = await prisma.$queryRawUnsafe(`SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const empresa = empresas[0];

        let etapaDestino = (arte === 'Arquivo do Cliente') ? 'IMPRESSÃO' : 'ARTE';
        let briefingFinal = `${formData.briefingFormatado}\n\nEntrega: ${tipoEntrega.toUpperCase()}`;

        // 1. Inserir o Pedido no Neon primeiro (para ter o ID)
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (empresa_id, titulo, nome_cliente, whatsapp_cliente, servico, tipo_arte, briefing_completo, etapa, created_at, bitrix_deal_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 0)
            RETURNING id
        `, empresa.id, formData.titulo, formData.nomeCliente, formData.wppCliente, formData.servico, arte, briefingFinal, etapaDestino);

        const newPedidoId = insertResult[0].id;

        // --- MÁGICA DO CHATAPP (FREELANCER) ---
        if (arte === 'Setor de Arte' && supervisaoWpp) {
            console.log("Iniciando automação ChatApp...");
            const automacao = await criarGrupoProducao(formData.titulo, supervisaoWpp, briefingFinal);
            
            if (automacao) {
                // Salva o link do grupo no pedido para o cliente poder clicar em "Acompanhar"
                await prisma.$executeRawUnsafe(`
                    UPDATE pedidos SET 
                        chatapp_chat_id = $1, 
                        link_acompanhar = $2 
                    WHERE id = $3
                `, automacao.chatId, automacao.groupLink, newPedidoId);
            }
        }

        // Financeiro (Se for Freelancer)
        if (arte === 'Setor de Arte' && parseFloat(valorDesigner) > 0) {
            await prisma.$executeRawUnsafe(`UPDATE empresas SET saldo = saldo - $1 WHERE id = $2`, parseFloat(valorDesigner), empresa.id);
            await prisma.$executeRawUnsafe(`INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) VALUES ($1, $2, 'SAIDA', $3, $4, NOW())`, empresa.id, parseFloat(valorDesigner), String(newPedidoId), `Produção: ${formData.titulo}`);
        }

        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        console.error("Erro geral:", error);
        return res.status(500).json({ message: error.message });
    }
};
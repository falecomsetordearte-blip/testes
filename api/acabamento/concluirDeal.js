// /api/acabamento/concluirDeal.js - COMPLETO E ATUALIZADO COM NOTIFICAÇÃO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// 1. IMPORTANDO A FUNÇÃO MÁGICA DE NOTIFICAÇÃO
const { enviarNotificacaoEtapa } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, dealId } = req.body;

        if (!dealId) return res.status(400).json({ message: 'ID do pedido é obrigatório.' });

        // 1. Validar Sessão
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });

        // 2. Buscar o pedido para saber o Tipo de Entrega
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, tipo_entrega FROM pedidos WHERE id = $1
        `, parseInt(dealId));

        if (pedidos.length === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        
        const pedido = pedidos[0];
        const entrega = (pedido.tipo_entrega || '').toUpperCase();

        // 3. Lógica de Destino Baseada na Entrega
        let novaEtapa = 'EXPEDIÇÃO'; // Padrão

        if (entrega.includes('EXTERNA')) {
            novaEtapa = 'INSTALAÇÃO EXTERNA';
        } else if (entrega.includes('LOJA')) {
            novaEtapa = 'INSTALAÇÃO NA LOJA';
        } else {
            novaEtapa = 'EXPEDIÇÃO';
        }

        // 4. Atualizar no Neon
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = $1, updated_at = NOW() 
            WHERE id = $2
        `, novaEtapa, parseInt(dealId));

        // =========================================================================
        // 5. DISPARAR NOTIFICAÇÃO AUTOMÁTICA NO GRUPO DO CLIENTE
        // =========================================================================
        try {
            // Aguarda o envio, mas se falhar cai no catch local e não quebra o sistema
            await enviarNotificacaoEtapa(dealId, novaEtapa);
        } catch (notifError) {
            console.error('[CHATAPP AVISO] Falha silenciada ao notificar cliente:', notifError.message);
        }
        // =========================================================================

        return res.status(200).json({ 
            success: true, 
            message: `Pedido concluído e enviado para ${novaEtapa}`,
            destino: novaEtapa 
        });

    } catch (error) {
        console.error('[concluirDeal Acabamento] Erro:', error);
        return res.status(500).json({ message: 'Erro ao concluir etapa.' });
    }
};
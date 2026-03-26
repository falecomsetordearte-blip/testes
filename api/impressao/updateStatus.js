// /api/impressao/updateStatus.js - COMPLETO COM NOTIFICAÇÃO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// 1. IMPORTANDO A FUNÇÃO DE NOTIFICAÇÃO
const { enviarNotificacaoEtapa } = require('../helpers/chatapp');

const STATUS_ID_PRONTO = '2663';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { dealId, statusId } = req.body;

        if (!dealId || !statusId) return res.status(400).json({ message: 'Dados insuficientes.' });

        // 1. Atualizar o status interno da impressão
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET status_impressao = $1 
            WHERE id = $2
        `, statusId, parseInt(dealId));

        // 2. Se mudou para "Pronto", envia o pedido para a etapa ACABAMENTO
        if (statusId === STATUS_ID_PRONTO) {
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos 
                SET etapa = 'ACABAMENTO', updated_at = NOW()
                WHERE id = $1
            `, parseInt(dealId));

            // =========================================================================
            // DISPARAR NOTIFICAÇÃO AUTOMÁTICA NO GRUPO DO CLIENTE
            // =========================================================================
            try {
                // Notifica que o pedido (finalizado pela Impressão) foi para o Acabamento
                await enviarNotificacaoEtapa(dealId, 'ACABAMENTO');
            } catch (notifError) {
                console.error('[CHATAPP AVISO] Falha silenciada ao notificar cliente:', notifError.message);
            }
            // =========================================================================

            return res.status(200).json({ 
                message: 'Pedido finalizado e enviado para Acabamento!',
                movedToNextStage: true 
            });
        }

        return res.status(200).json({ 
            message: 'Status atualizado com sucesso!',
            movedToNextStage: false
        });

    } catch (error) {
        console.error('[updateStatus Impressão] Erro:', error);
        return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
};
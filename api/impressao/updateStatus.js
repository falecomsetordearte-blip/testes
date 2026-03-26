// /api/impressao/updateStatus.js - CORRIGIDO AUTENTICAÇÃO FUNCIONÁRIOS
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { enviarNotificacaoEtapa } = require('../helpers/chatapp');

const STATUS_ID_PRONTO = '2663';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, dealId, statusId } = req.body;

        if (!dealId || !statusId || !sessionToken) return res.status(400).json({ message: 'Dados insuficientes.' });

        // 1. Validar Sessão (DUPLA CHECAGEM: Funcionários e Donos)
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if(users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const legacy = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if(legacy.length > 0) empresaId = legacy[0].id;
        }

        if (!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });

        // Atualiza o status interno da impressão
        await prisma.$executeRawUnsafe(`UPDATE pedidos SET status_impressao = $1 WHERE id = $2`, statusId, parseInt(dealId));

        if (statusId === STATUS_ID_PRONTO) {
            await prisma.$executeRawUnsafe(`UPDATE pedidos SET etapa = 'ACABAMENTO', updated_at = NOW() WHERE id = $1`, parseInt(dealId));
            try { await enviarNotificacaoEtapa(dealId, 'ACABAMENTO'); } catch (e) {}

            return res.status(200).json({ message: 'Pedido finalizado e enviado para Acabamento!', movedToNextStage: true });
        }

        return res.status(200).json({ message: 'Status atualizado com sucesso!', movedToNextStage: false });

    } catch (error) {
        console.error('[updateStatus Impressão] Erro:', error);
        return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
};
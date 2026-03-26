// /api/instalacao-loja/concluir.js - CORRIGIDO AUTENTICAÇÃO FUNCIONÁRIOS
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { enviarNotificacaoEtapa } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, dealId } = req.body;

        if (!dealId) return res.status(400).json({ message: 'ID do pedido obrigatório.' });

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

        await prisma.$executeRawUnsafe(`UPDATE pedidos SET etapa = 'EXPEDIÇÃO', updated_at = NOW() WHERE id = $1`, parseInt(dealId));

        try { await enviarNotificacaoEtapa(dealId, 'EXPEDIÇÃO'); } catch (e) {}

        return res.status(200).json({ success: true, message: 'Instalação na loja concluída com sucesso!' });

    } catch (error) {
        console.error('[concluir Instalação Loja] Erro:', error);
        return res.status(500).json({ message: 'Erro ao concluir.' });
    }
};
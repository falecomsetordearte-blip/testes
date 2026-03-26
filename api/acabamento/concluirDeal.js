// /api/acabamento/concluirDeal.js - CORRIGIDO AUTENTICAÇÃO FUNCIONÁRIOS
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

        if (!dealId) return res.status(400).json({ message: 'ID do pedido é obrigatório.' });

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

        // 2. Buscar o pedido
        const pedidos = await prisma.$queryRawUnsafe(`SELECT id, tipo_entrega FROM pedidos WHERE id = $1`, parseInt(dealId));
        if (pedidos.length === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        
        const pedido = pedidos[0];
        const entrega = (pedido.tipo_entrega || '').toUpperCase();

        // 3. Lógica de Destino
        let novaEtapa = 'EXPEDIÇÃO';
        if (entrega.includes('EXTERNA')) novaEtapa = 'INSTALAÇÃO EXTERNA';
        else if (entrega.includes('LOJA')) novaEtapa = 'INSTALAÇÃO NA LOJA';

        // 4. Atualizar
        await prisma.$executeRawUnsafe(`UPDATE pedidos SET etapa = $1, updated_at = NOW() WHERE id = $2`, novaEtapa, parseInt(dealId));

        // 5. Notificação
        try { await enviarNotificacaoEtapa(dealId, novaEtapa); } catch (e) {}

        return res.status(200).json({ success: true, message: `Pedido enviado para ${novaEtapa}`, destino: novaEtapa });

    } catch (error) {
        console.error('[concluirDeal Acabamento] Erro:', error);
        return res.status(500).json({ message: 'Erro ao concluir etapa.' });
    }
};
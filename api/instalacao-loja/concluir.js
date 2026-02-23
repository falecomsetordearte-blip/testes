// /api/instalacao-loja/concluir.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, dealId } = req.body;

        if (!dealId) return res.status(400).json({ message: 'ID do pedido obrigatório.' });

        // 1. Validar Usuário
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });

        // 2. Atualizar Etapa para EXPEDIÇÃO no Neon
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'EXPEDIÇÃO', updated_at = NOW() 
            WHERE id = $1
        `, parseInt(dealId));

        return res.status(200).json({ 
            success: true, 
            message: 'Instalação na loja concluída com sucesso!' 
        });

    } catch (error) {
        console.error('[concluir Instalação Loja] Erro:', error);
        return res.status(500).json({ message: 'Erro ao concluir.' });
    }
};
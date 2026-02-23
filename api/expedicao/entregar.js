// /api/expedicao/entregar.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, id } = req.body;
        if (!sessionToken || !id) return res.status(400).json({ message: 'Dados incompletos' });

        // 1. Validar Empresa
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida' });
        const empresaId = empresas[0].id;

        // 2. Atualizar para Entregue e Mover etapa para CONCLUÍDO
        const resultado = await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET status_expedicao = 'Entregue', 
                etapa = 'CONCLUÍDO',
                updated_at = NOW() 
            WHERE id = $1 
            AND empresa_id = $2
        `, parseInt(id), empresaId);

        if (resultado === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou acesso negado.' });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro Expedição Entregar:", error);
        return res.status(500).json({ message: 'Erro ao atualizar status' });
    }
};
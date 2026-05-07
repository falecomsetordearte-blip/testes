// /api/updateFinancialDealStatus.js - VERSÃO LOCAL (PRISMA)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    console.log("[Financeiro] Iniciando atualização de status...");

    try {
        const { sessionToken, dealId, acao } = req.body; // acao: 'PAGO' ou 'COBRAR'

        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Dados incompletos' });
        }

        // 1. Validar Token e Empresa
        const user = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (!user || user.length === 0) {
            return res.status(401).json({ message: 'Sessão inválida' });
        }

        const empresaId = user[0].empresa_id;
        console.log(`[Financeiro] Atualizando pedido ${dealId} para status: ${acao} (Empresa: ${empresaId})`);

        // 2. Atualizar o Status Financeiro no Pedido
        // Usamos raw query para garantir compatibilidade se a model não estiver no schema.prisma
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET status_financeiro = $1
            WHERE id = $2 AND empresa_id = $3
        `, acao, parseInt(dealId), empresaId);

        console.log(`[Financeiro] Pedido ${dealId} atualizado com sucesso.`);

        return res.status(200).json({ message: 'Status atualizado com sucesso' });

    } catch (error) {
        console.error('Erro updateFinancialDealStatus:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
};
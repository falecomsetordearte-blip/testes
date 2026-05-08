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

        // 1. Validar Token e Empresa (com fallback para usuários legados)
        let empresaId = null;

        const userCheck = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (userCheck && userCheck.length > 0) {
            empresaId = userCheck[0].empresa_id;
        } else {
            // Fallback: busca na tabela de empresas (usuários legados)
            const empresaCheck = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresaCheck && empresaCheck.length > 0) {
                empresaId = empresaCheck[0].id;
            }
        }

        if (!empresaId) {
            console.error("[Financeiro] Token inválido ou empresa não encontrada.");
            return res.status(401).json({ message: 'Sessão inválida' });
        }

        const empresaId_int = parseInt(empresaId);

        console.log(`[Financeiro] Atualizando pedido ${dealId} para status: ${acao} (Empresa: ${empresaId})`);

        // 2. Atualizar o Status Financeiro no Pedido
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET status_financeiro = $1
            WHERE id = $2 AND empresa_id = $3
        `, acao, parseInt(dealId), empresaId_int);

        console.log(`[Financeiro] Pedido ${dealId} atualizado com sucesso para: ${acao}`);

        return res.status(200).json({ message: 'Status atualizado com sucesso' });

    } catch (error) {
        console.error('[Financeiro] Erro ao atualizar status:', error);
        return res.status(500).json({ message: 'Erro ao atualizar status.' });
    } finally {
        await prisma.$disconnect();
    }
};
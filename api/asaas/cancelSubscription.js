// /api/asaas/cancelSubscription.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    console.log(`[CANCEL SUBSCRIPTION] Recebendo solicitação...`);

    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token é obrigatório.' });

        const tokenBusca = `%${token}%`;
        
        // 1. Identificar Usuário e pegar ID da assinatura
        let usuario = null;
        let tabela = null;
        let idColuna = null;

        // Tenta Empresa
        const empresas = await prisma.$queryRawUnsafe(`SELECT id, asaas_subscription_id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, tokenBusca);
        if (empresas.length > 0) {
            usuario = empresas[0];
            tabela = 'empresas';
            idColuna = 'id';
        } else {
            // Tenta Designer
            const designers = await prisma.$queryRawUnsafe(`SELECT designer_id as id, asaas_subscription_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1`, tokenBusca);
            if (designers.length > 0) {
                usuario = designers[0];
                tabela = 'designers_financeiro';
                idColuna = 'designer_id';
            }
        }

        if (!usuario || !usuario.asaas_subscription_id) {
            return res.status(400).json({ message: 'Assinatura não encontrada ou sessão inválida.' });
        }

        console.log(`[CANCEL SUBSCRIPTION] Cancelando assinatura ${usuario.asaas_subscription_id} no Asaas...`);

        // 2. Cancelar no Asaas (Delete Subscription)
        // Isso interrompe a recorrência. As faturas já pagas continuam válidas.
        await axios.delete(`${ASAAS_BASE_URL}/subscriptions/${usuario.asaas_subscription_id}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        // 3. Atualizar status no banco de dados local para 'CANCELLED' ou similar 
        // O Webhook do Asaas também deve enviar um evento SUBSCRIPTION_DELETED que fará isso.
        // Mas podemos forçar uma atualização aqui para feedback imediato no front se desejar.
        // Por segurança, vamos atualizar o campo asaas_subscription_id para NULL no futuro ou apenas marcar status.
        // Vamos apenas marcar como INATIVO para refletir na interface.
        
        await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET assinatura_status = 'INATIVO', plan_type = 'FREE' WHERE ${idColuna} = $1`, usuario.id);

        console.log(`[CANCEL SUBSCRIPTION] Assinatura cancelada com sucesso.`);

        return res.status(200).json({
            success: true,
            message: 'Assinatura cancelada! Você não receberá novas cobranças.'
        });

    } catch (error) {
        console.error("[CANCEL SUBSCRIPTION] ERRO:", error.response?.data || error.message);
        const errorMsg = error.response?.data?.errors?.[0]?.description || 'Erro ao cancelar assinatura no Asaas.';
        return res.status(500).json({ message: errorMsg });
    }
};

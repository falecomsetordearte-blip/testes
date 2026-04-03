// /api/asaas/getSubscription.js
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

    console.log(`[GET SUBSCRIPTION] Iniciando busca de detalhes...`);

    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token é obrigatório.' });

        const tokenBusca = `%${token}%`;
        
        // 1. Identificar Usuário (Empresa ou Designer)
        let usuario = null;
        let tipo = null;

        // Tenta achar via Painel_Usuarios (Novo/Migrado)
        const userNovo = await prisma.$queryRawUnsafe(`
            SELECT e.id, u.nome, e.asaas_subscription_id, e.asaas_customer_id, e.assinatura_status 
            FROM painel_usuarios u
            JOIN empresas e ON u.empresa_id = e.id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, tokenBusca);

        if (userNovo.length > 0) {
            usuario = userNovo[0];
            tipo = 'empresa';
        } else {
            // Tenta achar na raiz Empresas (Legacy)
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id, nome_fantasia as nome, asaas_subscription_id, asaas_customer_id, assinatura_status 
                FROM empresas 
                WHERE session_tokens LIKE $1 LIMIT 1
            `, tokenBusca);
            
            if (empresasLegacy.length > 0) {
                usuario = empresasLegacy[0];
                tipo = 'empresa';
            } else {
                // Tenta Designer
                const designers = await prisma.$queryRawUnsafe(`
                    SELECT designer_id as id, nome, asaas_subscription_id, asaas_customer_id, assinatura_status 
                    FROM designers_financeiro 
                    WHERE session_tokens LIKE $1 LIMIT 1
                `, tokenBusca);
                
                if (designers.length > 0) {
                    usuario = designers[0];
                    tipo = 'designer';
                }
            }
        }

        if (!usuario) return res.status(403).json({ message: 'Sessão inválida.' });

        // Se não tem ID de assinatura, retorna apenas o status inativo básico
        if (!usuario.asaas_subscription_id) {
            return res.status(200).json({ 
                hasSubscription: false, 
                status: usuario.assinatura_status || 'INATIVO',
                tipo: tipo
            });
        }

        console.log(`[GET SUBSCRIPTION] Consultando Asaas para Assinatura: ${usuario.asaas_subscription_id}`);

        // 2. Buscar Detalhes da Assinatura no Asaas
        const subResponse = await axios.get(`${ASAAS_BASE_URL}/subscriptions/${usuario.asaas_subscription_id}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        // 3. Buscar Histórico de Pagamentos (últimas 10 cobranças)
        const paymentsResponse = await axios.get(`${ASAAS_BASE_URL}/payments?subscription=${usuario.asaas_subscription_id}&limit=10`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        console.log(`[GET SUBSCRIPTION] Detalhes recuperados com sucesso.`);

        return res.status(200).json({
            hasSubscription: true,
            status: subResponse.data.status,
            value: subResponse.data.value,
            cycle: subResponse.data.cycle,
            nextDueDate: subResponse.data.nextDueDate,
            billingType: subResponse.data.billingType,
            tipo: tipo,
            history: paymentsResponse.data.data.map(p => ({
                id: p.id,
                date: p.paymentDate || p.dueDate,
                value: p.value,
                netValue: p.netValue,
                status: p.status,
                billingType: p.billingType,
                invoiceUrl: p.invoiceUrl,
                bankSlipUrl: p.bankSlipUrl,
                transactionReceiptUrl: p.transactionReceiptUrl
            }))
        });

    } catch (error) {
        console.error("[GET SUBSCRIPTION] ERRO:", error.response?.data || error.message);
        return res.status(500).json({ message: 'Erro ao recuperar dados do Asaas.', details: error.message });
    }
};

// /api/asaas/subscribe.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

// Pega das variáveis de ambiente da Vercel
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, tipo, paymentMethod = 'PIX', creditCard = null, creditCardHolderInfo = null } = req.body;
        
        if (!token || !tipo) return res.status(400).json({ message: 'Token e tipo são obrigatórios.' });
        if (!ASAAS_API_KEY) return res.status(500).json({ message: 'Configuração de API Asaas faltando na Vercel.' });

        let usuario, idColuna;

        // 1. Identificar Usuário
        if (tipo === 'empresa') {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id, cnpj as documento, nome_fantasia as nome, email, asaas_customer_id, asaas_subscription_id FROM empresas WHERE session_tokens = $1 LIMIT 1`, token);
            if (empresas.length > 0) { usuario = empresas[0]; idColuna = 'id'; }
        } else {
            const designers = await prisma.$queryRawUnsafe(`SELECT designer_id as id, email, nome, email as documento, asaas_customer_id, asaas_subscription_id FROM designers_financeiro WHERE session_tokens = $1 LIMIT 1`, token);
            if (designers.length > 0) { usuario = designers[0]; idColuna = 'designer_id'; }
        }

        if (!usuario) return res.status(403).json({ message: 'Sessão inválida.' });

        const valorAssinatura = tipo === 'empresa' ? 49.90 : 29.90;
        let asaasCustomerId = usuario.asaas_customer_id;
        const tabela = tipo === 'empresa' ? 'empresas' : 'designers_financeiro';

        // 2. Criar Cliente no Asaas se não existir
        if (!asaasCustomerId) {
            console.log(`[ASAAS] Criando cliente para ${usuario.email}`);
            const customerPayload = { 
                name: usuario.nome, 
                cpfCnpj: usuario.documento ? usuario.documento.replace(/\D/g, '') : '00000000000', 
                email: usuario.email 
            };
            const responseCustomer = await axios.post(`${ASAAS_BASE_URL}/customers`, customerPayload, { headers: { 'access_token': ASAAS_API_KEY } });
            asaasCustomerId = responseCustomer.data.id;
            await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET asaas_customer_id = $1 WHERE ${idColuna} = $2`, asaasCustomerId, usuario.id);
        }

        // 3. Gerar Assinatura Recorrente (Cycle: MONTHLY garante a recorrência)
        let subscriptionId = usuario.asaas_subscription_id;
        const dueDate = new Date().toISOString().split('T')[0];

        const subPayload = { 
            customer: asaasCustomerId,
            billingType: paymentMethod, 
            nextDueDate: dueDate, 
            value: valorAssinatura, 
            cycle: 'MONTHLY', 
            description: `Assinatura Recorrente Setor de Arte - ${tipo.toUpperCase()}` 
        };

        if (paymentMethod === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
            subPayload.creditCard = creditCard;
            subPayload.creditCardHolderInfo = creditCardHolderInfo;
        }

        console.log(`[ASAAS] Criando assinatura recorrente para ${asaasCustomerId}`);
        const subResponse = await axios.post(`${ASAAS_BASE_URL}/subscriptions`, subPayload, { headers: { 'access_token': ASAAS_API_KEY } });
        subscriptionId = subResponse.data.id;

        // Atualiza banco com ID da assinatura
        await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET asaas_subscription_id = $1, assinatura_status = 'PENDING' WHERE ${idColuna} = $2`, subscriptionId, usuario.id);

        // 4. Buscar a cobrança gerada por esta assinatura
        const paymentsReq = await axios.get(`${ASAAS_BASE_URL}/payments?subscription=${subscriptionId}&status=PENDING`, { headers: { 'access_token': ASAAS_API_KEY } });
        
        if (paymentsReq.data.data.length === 0) {
            // Se for cartão, pode já ter aprovado
            const subCheck = await axios.get(`${ASAAS_BASE_URL}/subscriptions/${subscriptionId}`, { headers: { 'access_token': ASAAS_API_KEY } });
            if (subCheck.data.status === 'ACTIVE') {
                await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET assinatura_status = 'ACTIVE' WHERE ${idColuna} = $1`, usuario.id);
                return res.status(200).json({ success: true, status: 'ACTIVE' });
            }
        }

        const currentPayment = paymentsReq.data.data[0];

        // 5. Retornar dados de pagamento
        if (paymentMethod === 'PIX') {
            const pixReq = await axios.get(`${ASAAS_BASE_URL}/payments/${currentPayment.id}/pixQrCode`, { headers: { 'access_token': ASAAS_API_KEY } });
            return res.status(200).json({ success: true, paymentMethod: 'PIX', status: 'PENDING', pixUrl: pixReq.data.encodedImage, pixCode: pixReq.data.payload });
        } else if (paymentMethod === 'BOLETO') {
            return res.status(200).json({ success: true, paymentMethod: 'BOLETO', status: 'PENDING', boletoUrl: currentPayment.bankSlipUrl });
        } else {
            return res.status(200).json({ success: true, paymentMethod: 'CREDIT_CARD', status: 'PENDING', message: 'Pagamento em análise pelo banco.' });
        }

    } catch (error) {
        console.error("Erro Asaas:", error.response?.data || error.message);
        const errorMsg = error.response?.data?.errors?.[0]?.description || 'Erro na integração com Asaas.';
        return res.status(400).json({ message: errorMsg });
    }
};
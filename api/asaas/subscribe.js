// api/asaas/subscribe.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6Ojk4ODBiMzMwLWI5NGQtNGExNC05ZjlkLWJmZTZjYzA1OGFmOTo6JGFhY2hfOGNjZTliYmMtZjA5NS00YTBlLTlkMzQtNTY0NmExYzZiMDJl';
const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, tipo, paymentMethod = 'PIX', creditCard = null, creditCardHolderInfo = null } = req.body;
        if (!token || !tipo) return res.status(400).json({ message: 'Token e tipo de usuário são obrigatórios.' });

        let usuario, empresaId, designerId;
        if (tipo === 'empresa') {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id, cnpj, nome_fantasia as nome, email, asaas_customer_id, asaas_subscription_id, assinatura_status FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
            if (empresas.length > 0) { usuario = empresas[0]; empresaId = usuario.id; }
        } else if (tipo === 'designer') {
            const designers = await prisma.$queryRawUnsafe(`
                SELECT d.designer_id as id, d.asaas_customer_id, d.asaas_subscription_id, d.assinatura_status, u.nome, u.email
                FROM designers_financeiro d
                JOIN painel_usuarios u ON u.id = d.designer_id
                WHERE u.session_tokens LIKE $1 LIMIT 1
            `, `%${token}%`); 
            if (designers.length > 0) { usuario = designers[0]; designerId = usuario.id; }
        }

        if (!usuario) return res.status(403).json({ message: 'Sessão inválida.' });

        const valorAssinatura = tipo === 'empresa' ? 49.90 : 29.90;
        let asaasCustomerId = usuario.asaas_customer_id;
        
        if (!asaasCustomerId) {
            let cpfCnpjFormatado = usuario.cnpj ? usuario.cnpj.replace(/\D/g, '') : '00000000000';
            const customerPayload = { name: usuario.nome || `Usuário ${usuario.id || 'Teste'}`, cpfCnpj: cpfCnpjFormatado, email: usuario.email || '' };
            const responseCustomer = await axios.post(`${ASAAS_BASE_URL}/customers`, customerPayload, { headers: { 'access_token': ASAAS_API_KEY } });
            asaasCustomerId = responseCustomer.data.id;
            if (tipo === 'empresa') await prisma.$executeRawUnsafe(`UPDATE empresas SET asaas_customer_id = $1 WHERE id = $2`, asaasCustomerId, empresaId);
            else await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET asaas_customer_id = $1 WHERE designer_id = $2`, asaasCustomerId, designerId);
        }

        let subscriptionId = usuario.asaas_subscription_id;
        let dueDate = new Date().toISOString().split('T')[0];

        const subPayload = { 
            billingType: paymentMethod, 
            nextDueDate: dueDate, 
            value: valorAssinatura, 
            cycle: 'MONTHLY', 
            description: `Assinatura Mensal - Plataforma Setor de Arte - ${tipo.toUpperCase()}` 
        };

        if (paymentMethod === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
            subPayload.creditCard = creditCard;
            subPayload.creditCardHolderInfo = creditCardHolderInfo;
        }

        if (!subscriptionId) {
            subPayload.customer = asaasCustomerId;
            const subResponse = await axios.post(`${ASAAS_BASE_URL}/subscriptions`, subPayload, { headers: { 'access_token': ASAAS_API_KEY } });
            subscriptionId = subResponse.data.id;
            if (tipo === 'empresa') await prisma.$executeRawUnsafe(`UPDATE empresas SET asaas_subscription_id = $1, assinatura_status = 'PENDING' WHERE id = $2`, subscriptionId, empresaId);
            else await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET asaas_subscription_id = $1, assinatura_status = 'PENDING' WHERE designer_id = $2`, subscriptionId, designerId);
        } else {
            // Atualiza a assinatura caso tenha mudado o método de pagamento
            await axios.post(`${ASAAS_BASE_URL}/subscriptions/${subscriptionId}`, subPayload, { headers: { 'access_token': ASAAS_API_KEY } });
        }

        // Recupera a cobrança pendente atrelada à assinatura
        const paymentsReq = await axios.get(`${ASAAS_BASE_URL}/payments?subscription=${subscriptionId}&status=PENDING`, { headers: { 'access_token': ASAAS_API_KEY } });
        
        // Se não tem cobranças pendentes, ou já foi pago (ACTIVE) no cartão instantaneamente
        if (paymentsReq.data.data.length === 0) {
            // Verifica se o status REAL da subscrição é ACTIVE
            const subCheck = await axios.get(`${ASAAS_BASE_URL}/subscriptions/${subscriptionId}`, { headers: { 'access_token': ASAAS_API_KEY } });
            if (subCheck.data.status === 'ACTIVE') {
                if (tipo === 'empresa') await prisma.$executeRawUnsafe(`UPDATE empresas SET assinatura_status = 'ACTIVE' WHERE id = $2`, empresaId);
                else await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET assinatura_status = 'ACTIVE' WHERE designer_id = $2`, designerId);
                return res.status(200).json({ message: 'Assinatura Ativa.', status: 'ACTIVE' });
            } else {
                return res.status(400).json({ message: 'Pagamento de cartão recusado ou processando. Aguarde o webhook.', status: 'PENDING' });
            }
        }

        const currentPayment = paymentsReq.data.data[0];

        if (paymentMethod === 'PIX') {
            const pixReq = await axios.get(`${ASAAS_BASE_URL}/payments/${currentPayment.id}/pixQrCode`, { headers: { 'access_token': ASAAS_API_KEY } });
            return res.status(200).json({ success: true, paymentMethod: 'PIX', status: 'PENDING', pixUrl: pixReq.data.encodedImage, pixCode: pixReq.data.payload });
        } else if (paymentMethod === 'BOLETO') {
            return res.status(200).json({ success: true, paymentMethod: 'BOLETO', status: 'PENDING', boletoUrl: currentPayment.bankSlipUrl });
        } else {
            // Cartão de crédito geralmente aprova na hora e a subscription vira ACTIVE acima, 
            // mas se ainda estiver PENDING, o Asaas pode estar em analise de fraude.
            return res.status(200).json({ success: true, paymentMethod: 'CREDIT_CARD', status: 'PENDING', message: 'Pagamento em análise.' });
        }

    } catch (error) {
        console.error("Erro na integração Asaas:", error.response ? error.response.data : error.message);
        return res.status(500).json({ message: error.response?.data?.errors?.[0]?.description || 'Erro na integração Asaas.' });
    }
};

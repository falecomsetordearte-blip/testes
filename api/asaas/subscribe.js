// api/asaas/subscribe.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios'); // Para comunicação com o Asaas

// KEY e URL de ambiente (sandbox ou prod)
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6Ojk4ODBiMzMwLWI5NGQtNGExNC05ZjlkLWJmZTZjYzA1OGFmOTo6JGFhY2hfOGNjZTliYmMtZjA5NS00YTBlLTlkMzQtNTY0NmExYzZiMDJl';
const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, tipo } = req.body;

        if (!token || !tipo) return res.status(400).json({ message: 'Token e tipo de usuário são obrigatórios.' });

        let usuario, empresaId, designerId;
        
        if (tipo === 'empresa') {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id, cnpj, nome_fantasia as nome, asaas_customer_id, asaas_subscription_id, assinatura_status FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
            if (empresas.length > 0) { usuario = empresas[0]; empresaId = usuario.id; }
        } else if (tipo === 'designer') {
            const designers = await prisma.$queryRawUnsafe(`
                SELECT d.designer_id as id, d.asaas_customer_id, d.asaas_subscription_id, d.assinatura_status, u.nome
                FROM designers_financeiro d
                JOIN painel_usuarios u ON u.id = d.designer_id
                WHERE u.session_tokens LIKE $1 LIMIT 1
            `, `%${token}%`); 
            if (designers.length > 0) { usuario = designers[0]; designerId = usuario.id; }
        }

        if (!usuario) return res.status(403).json({ message: 'Sessão inválida.' });

        // Valores de Mensalidade
        const valorAssinatura = tipo === 'empresa' ? 49.90 : 29.90;
        
        // 1. Criar Customer no Asaas (Se Não Existir)
        let asaasCustomerId = usuario.asaas_customer_id;
        
        if (!asaasCustomerId) {
            // No modo de teste, usaremos dados fictícios para criar o customer
            const customerPayload = {
                name: usuario.nome || `Usuário ${usuario.id || 'Teste'}`,
                cpfCnpj: usuario.cnpj || '00000000000', // Asaas exige formato válido se preenchido. Como o Designer ñ tem CPF ainda, vamos omitir ou preencher um genérico
            };

            const responseCustomer = await axios.post(`${ASAAS_BASE_URL}/customers`, customerPayload, {
                headers: { 'access_token': ASAAS_API_KEY }
            });

            asaasCustomerId = responseCustomer.data.id;

            // Salvar no BD
            if (tipo === 'empresa') {
                await prisma.$executeRawUnsafe(`UPDATE empresas SET asaas_customer_id = $1 WHERE id = $2`, asaasCustomerId, empresaId);
            } else {
                await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET asaas_customer_id = $1 WHERE designer_id = $2`, asaasCustomerId, designerId);
            }
        }

        // 2. Criar a Assinatura (MENSAL - PIX) no Asaas
        let subscriptionId = usuario.asaas_subscription_id;
        let pmt_status = 'PENDING';
        let subResponse = null;

        if (!subscriptionId) {
            // Data do primeiro vencimento para hoje
            let today = new Date();
            let dueDate = today.toISOString().split('T')[0]; // YYYY-MM-DD

            const subPayload = {
                customer: asaasCustomerId,
                billingType: 'PIX',
                nextDueDate: dueDate,
                value: valorAssinatura,
                cycle: 'MONTHLY',
                description: `Assinatura Mensal - Plataforma Setor de Arte - ${tipo.toUpperCase()}`
            };

            subResponse = await axios.post(`${ASAAS_BASE_URL}/subscriptions`, subPayload, {
                headers: { 'access_token': ASAAS_API_KEY }
            });

            subscriptionId = subResponse.data.id;

            // O Asaas não devolve o payload PIX diretamente na criação da Subscription.
            // Precisamos buscar a Cobrança (Payment) filha que foi gerada na data de hoje.

            // Salvar no BD
            if (tipo === 'empresa') {
                await prisma.$executeRawUnsafe(`UPDATE empresas SET asaas_subscription_id = $1, assinatura_status = $2 WHERE id = $3`, subscriptionId, pmt_status, empresaId);
            } else {
                await prisma.$executeRawUnsafe(`UPDATE designers_financeiro SET asaas_subscription_id = $1, assinatura_status = $2 WHERE designer_id = $3`, subscriptionId, pmt_status, designerId);
            }
        }

        // 3. Buscar a Cobrança PENDENTE gerada por essa assinatura
        // Listar cobranças da subscription que estejam PENDING
        const paymentsReq = await axios.get(`${ASAAS_BASE_URL}/payments?subscription=${subscriptionId}&status=PENDING`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        if (paymentsReq.data.data.length === 0) {
            return res.status(200).json({ message: 'Nenhuma fatura pendente encontarda. Status ativo?', status: 'ACTIVE' });
        }

        const currentPaymentId = paymentsReq.data.data[0].id;

        // 4. Pegar o PIX QR CODE da Cobrança filha
        const pixReq = await axios.get(`${ASAAS_BASE_URL}/payments/${currentPaymentId}/pixQrCode`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        return res.status(200).json({ 
            success: true, 
            status: 'PENDING',
            pixUrl: pixReq.data.encodedImage, 
            pixCode: pixReq.data.payload 
        });

    } catch (error) {
        console.error("Erro na integração Asaas:", error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro na integração com o banco Asaas.', erro: error.response?.data?.errors });
    }
};

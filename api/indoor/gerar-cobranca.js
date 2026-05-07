// /api/indoor/gerar-cobranca.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, pedidoId } = req.body;
        if (!sessionToken || !pedidoId) return res.status(400).json({ message: 'Dados incompletos.' });

        console.log(`[INDOOR-COBRANCA] Gerando cobrança para pedido #${pedidoId}`);

        // 1. Identificar empresa
        let empresa = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, e.nome_fantasia, e.email, e.asaas_customer_id
            FROM painel_usuarios u
            LEFT JOIN empresas e ON e.id = u.empresa_id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresa = { id: users[0].empresa_id, nome: users[0].nome_fantasia, email: users[0].email, customerId: users[0].asaas_customer_id };
        } else {
            const leg = await prisma.$queryRawUnsafe(`
                SELECT id, nome_fantasia, email, asaas_customer_id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (leg.length > 0) empresa = { id: leg[0].id, nome: leg[0].nome_fantasia, email: leg[0].email, customerId: leg[0].asaas_customer_id };
        }

        if (!empresa) return res.status(403).json({ message: 'Sessão inválida.' });
        console.log(`[INDOOR-COBRANCA] Empresa: ${empresa.nome} (ID: ${empresa.id})`);

        // 2. Buscar pedido
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, valor_pago, briefing_completo
            FROM pedidos WHERE id = $1 AND empresa_id = $2 AND tipo_sistema = 'indoor'
        `, parseInt(pedidoId), empresa.id);

        if (pedidos.length === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        const pedido = pedidos[0];
        const valor = parseFloat(pedido.valor_pago || 0);
        if (!valor || valor <= 0) return res.status(400).json({ message: 'Valor do pedido inválido.' });

        console.log(`[INDOOR-COBRANCA] Pedido: "${pedido.titulo}" | Valor: R$ ${valor}`);

        // 3. Garantir customer_id no Asaas
        let asaasCustomerId = empresa.customerId;
        if (!asaasCustomerId) {
            console.log(`[INDOOR-COBRANCA] Criando customer no Asaas para empresa ${empresa.nome}...`);
            const cr = await axios.post(`${ASAAS_API_URL}/customers`, {
                name: empresa.nome || 'Cliente Indoor',
                email: empresa.email || '',
                notificationDisabled: true
            }, { headers: { 'access_token': ASAAS_API_KEY } });
            asaasCustomerId = cr.data.id;
            await prisma.$executeRawUnsafe(`UPDATE empresas SET asaas_customer_id = $1 WHERE id = $2`, asaasCustomerId, empresa.id);
            console.log(`[INDOOR-COBRANCA] Customer Asaas criado: ${asaasCustomerId}`);
        }

        // 4. Gerar cobrança PIX
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const paymentData = {
            customer: asaasCustomerId,
            billingType: 'PIX',
            value: valor,
            dueDate: dueDateStr,
            description: `Pedido Indoor #${pedido.id} — ${pedido.titulo}`,
            externalReference: `indoor_${pedido.id}`
        };

        console.log(`[INDOOR-COBRANCA] Criando cobrança no Asaas...`);
        const asaasRes = await axios.post(`${ASAAS_API_URL}/payments`, paymentData, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        const paymentId = asaasRes.data.id;
        const invoiceUrl = asaasRes.data.invoiceUrl || asaasRes.data.bankSlipUrl;

        // 5. Salvar payment_id no pedido
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos SET asaas_payment_id = $1 WHERE id = $2
        `, paymentId, pedido.id);

        console.log(`[INDOOR-COBRANCA] Cobrança criada! PaymentID: ${paymentId}`);
        return res.status(200).json({ success: true, url: invoiceUrl, paymentId });

    } catch (error) {
        const msg = error.response?.data?.errors?.[0]?.description || error.message;
        console.error('[INDOOR-COBRANCA] Erro:', msg);
        return res.status(500).json({ message: 'Erro ao gerar cobrança: ' + msg });
    }
};

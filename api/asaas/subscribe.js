// /api/asaas/subscribe.js
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

    console.log(`[SUBSCRIBE ASAAS] Iniciando fluxo de assinatura...`);

    try {
        const { token, tipo, paymentMethod = 'PIX', customerCpf = null, creditCard = null, creditCardHolderInfo = null } = req.body;

        console.log(`[SUBSCRIBE ASAAS] Payload Recebido: Tipo=${tipo}, Metodo=${paymentMethod}, CPF informado=${customerCpf}`);

        if (!token || !tipo) return res.status(400).json({ message: 'Token e tipo são obrigatórios.' });
        if (!ASAAS_API_KEY) {
            console.error(`[SUBSCRIBE ASAAS] ERRO: Chave da API (ASAAS_API_KEY) não encontrada nas variáveis de ambiente!`);
            return res.status(500).json({ message: 'Configuração de API Asaas faltando na Vercel.' });
        }

        let usuario, idColuna;
        const tokenBusca = `%${token}%`;

        console.log(`[SUBSCRIBE ASAAS] Buscando usuário no banco de dados (${tipo})...`);

        if (tipo === 'empresa' || tipo === 'empresa_premium') {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id, cnpj as documento, nome_fantasia as nome, email, asaas_customer_id, asaas_subscription_id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, tokenBusca);
            if (empresas.length > 0) { usuario = empresas[0]; idColuna = 'id'; }
        } else {
            const designers = await prisma.$queryRawUnsafe(`SELECT designer_id as id, email, nome, asaas_customer_id, asaas_subscription_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1`, tokenBusca);
            if (designers.length > 0) { usuario = designers[0]; idColuna = 'designer_id'; }
        }

        if (!usuario) {
            console.log(`[SUBSCRIBE ASAAS] ERRO: Usuário não encontrado com o token fornecido.`);
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        console.log(`[SUBSCRIBE ASAAS] Usuário encontrado: ${usuario.nome} | Email: ${usuario.email} | ID DB: ${usuario.id}`);

        let valorAssinatura = 29.90;
        if (tipo === 'empresa') valorAssinatura = 49.90;
        else if (tipo === 'empresa_premium') valorAssinatura = 116.50;

        let asaasCustomerId = usuario.asaas_customer_id;
        const tabela = (tipo === 'empresa' || tipo === 'empresa_premium') ? 'empresas' : 'designers_financeiro';

        let docFinal = customerCpf ? customerCpf.replace(/\D/g, '') : (usuario.documento ? usuario.documento.replace(/\D/g, '') : '');

        if (!docFinal || (docFinal.length !== 11 && docFinal.length !== 14)) {
            console.log(`[SUBSCRIBE ASAAS] ERRO: Documento inválido. Documento processado: ${docFinal}`);
            return res.status(400).json({ message: 'Um CPF ou CNPJ válido é obrigatório para gerar a assinatura.' });
        }

        // 2. Tratar Cliente no Asaas
        if (!asaasCustomerId) {
            console.log(`[SUBSCRIBE ASAAS] Cliente NÃO possui asaas_customer_id. Criando novo cliente no Asaas...`);
            const customerPayload = { name: usuario.nome, cpfCnpj: docFinal, email: usuario.email };

            const responseCustomer = await axios.post(`${ASAAS_BASE_URL}/customers`, customerPayload, { headers: { 'access_token': ASAAS_API_KEY } });
            asaasCustomerId = responseCustomer.data.id;
            console.log(`[SUBSCRIBE ASAAS] Novo cliente criado com sucesso. ID Asaas: ${asaasCustomerId}`);

            await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET asaas_customer_id = $1 WHERE ${idColuna} = $2`, asaasCustomerId, usuario.id);
            console.log(`[SUBSCRIBE ASAAS] asaas_customer_id salvo no banco de dados.`);
        } else {
            console.log(`[SUBSCRIBE ASAAS] Cliente JÁ POSSUI asaas_customer_id: ${asaasCustomerId}. Tentando atualizar CPF/CNPJ no Asaas para ${docFinal}...`);
            try {
                await axios.post(`${ASAAS_BASE_URL}/customers/${asaasCustomerId}`, {
                    cpfCnpj: docFinal
                }, { headers: { 'access_token': ASAAS_API_KEY } });
                console.log(`[SUBSCRIBE ASAAS] Documento do cliente atualizado no Asaas.`);
            } catch (updateErr) {
                console.log(`[SUBSCRIBE ASAAS] Aviso: Falha ao atualizar documento no Asaas (Pode já estar correto). Prosseguindo...`);
            }
        }

        // 3. Gerar Assinatura Recorrente
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
            console.log(`[SUBSCRIBE ASAAS] Anexando dados de Cartão de Crédito ao payload...`);
            subPayload.creditCard = creditCard;
            subPayload.creditCardHolderInfo = creditCardHolderInfo;
        }

        console.log(`[SUBSCRIBE ASAAS] Criando assinatura no Asaas... Payload enviado:`, JSON.stringify(subPayload).replace(/"number":"\d+"/g, '"number":"****"').replace(/"ccv":"\d+"/g, '"ccv":"***"')); // Loga sem expor o cartão

        const subResponse = await axios.post(`${ASAAS_BASE_URL}/subscriptions`, subPayload, { headers: { 'access_token': ASAAS_API_KEY } });
        subscriptionId = subResponse.data.id;

        console.log(`[SUBSCRIBE ASAAS] Assinatura criada! ID Assinatura: ${subscriptionId}`);

        // Atualiza banco com ID da assinatura
        await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET asaas_subscription_id = $1, assinatura_status = 'PENDING' WHERE ${idColuna} = $2`, subscriptionId, usuario.id);
        
        if (tipo === 'empresa_premium') {
            await prisma.$executeRawUnsafe(`UPDATE empresas SET chatapp_plano = 'PREMIUM', chatapp_status = 'AGUARDANDO_ADMIN' WHERE id = $1`, usuario.id);
        }

        console.log(`[SUBSCRIBE ASAAS] Status 'PENDING' e asaas_subscription_id salvos no banco.`);

        // 4. Buscar a cobrança gerada por esta assinatura
        console.log(`[SUBSCRIBE ASAAS] Buscando cobranças (payments) vinculadas à assinatura ${subscriptionId}...`);
        const paymentsReq = await axios.get(`${ASAAS_BASE_URL}/payments?subscription=${subscriptionId}&status=PENDING`, { headers: { 'access_token': ASAAS_API_KEY } });

        if (paymentsReq.data.data.length === 0) {
            console.log(`[SUBSCRIBE ASAAS] Nenhuma cobrança PENDENTE encontrada após a criação.`);
            // Se não houver cobrança pendente, pode ser que já tenha sido paga (ex: cartão imediato)
            // Mas vamos deixar o Webhook confirmar para garantir sincronia perfeita com o banco.
            return res.status(200).json({ success: true, status: 'PENDING', message: 'Aguardando confirmação do pagamento.' });
        }

        const currentPayment = paymentsReq.data.data[0];
        console.log(`[SUBSCRIBE ASAAS] Cobrança atual encontrada: ${currentPayment.id}`);

        // 5. Retornar dados de pagamento
        if (paymentMethod === 'PIX') {
            console.log(`[SUBSCRIBE ASAAS] Gerando QR Code PIX...`);
            const pixReq = await axios.get(`${ASAAS_BASE_URL}/payments/${currentPayment.id}/pixQrCode`, { headers: { 'access_token': ASAAS_API_KEY } });
            console.log(`[SUBSCRIBE ASAAS] PIX gerado com sucesso. Devolvendo para frontend.`);
            return res.status(200).json({ success: true, paymentMethod: 'PIX', status: 'PENDING', pixUrl: pixReq.data.encodedImage, pixCode: pixReq.data.payload });
        } else if (paymentMethod === 'BOLETO') {
            console.log(`[SUBSCRIBE ASAAS] Devolvendo link do Boleto para frontend.`);
            return res.status(200).json({ success: true, paymentMethod: 'BOLETO', status: 'PENDING', boletoUrl: currentPayment.bankSlipUrl });
        } else {
            console.log(`[SUBSCRIBE ASAAS] Pagamento Cartão processado com sucesso. Devolvendo aviso de análise.`);
            return res.status(200).json({ success: true, paymentMethod: 'CREDIT_CARD', status: 'PENDING', message: 'Pagamento em análise pelo banco.' });
        }

    } catch (error) {
        console.error("[SUBSCRIBE ASAAS] ERRO na Integração Asaas:", error.response?.data || error.message);
        const errorMsg = error.response?.data?.errors?.[0]?.description || 'Erro na integração com Asaas.';
        return res.status(400).json({ message: errorMsg });
    }
};
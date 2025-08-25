// /api/payWithBalance.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const COMPANY_SALDO_FIELD = 'UF_CRM_1751913325'; // Campo de saldo na Empresa

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId } = req.body;
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Token e ID do pedido são obrigatórios.' });
        }

        // ETAPA 1: Encontrar o contato e a company pelo token
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }
        const companyId = user.COMPANY_ID;

        // ETAPA 2: Obter o saldo atual da empresa e o valor do pedido
        const [companyData, dealData] = await Promise.all([
            axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId }),
            axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId })
        ]);

        const saldoAtual = parseFloat(companyData.data.result[COMPANY_SALDO_FIELD] || 0);
        const valorPedido = parseFloat(dealData.data.result.OPPORTUNITY || 0) / 0.9;

        // ETAPA 3: Validar se o saldo é suficiente
        if (saldoAtual < valorPedido) {
            return res.status(402).json({ message: `Saldo insuficiente. Você tem R$ ${saldoAtual.toFixed(2)} e o pedido custa R$ ${valorPedido.toFixed(2)}.` });
        }

        // ETAPA 4: Calcular novo saldo e atualizar a empresa e o negócio
        const novoSaldo = saldoAtual - valorPedido;

        await Promise.all([
            axios.post(`${BITRIX24_API_URL}crm.company.update.json`, {
                id: companyId,
                fields: { [COMPANY_SALDO_FIELD]: novoSaldo.toFixed(2) }
            }),
            axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
                id: dealId,
                fields: { 
                    'STAGE_ID': 'C17:1' // IMPORTANTE: Altere para a etapa de "Pago" ou "Em Andamento" do seu pipeline 17
                }
            })
        ]);

        return res.status(200).json({ success: true, message: 'Pedido pago com sucesso!' });

    } catch (error) {
        console.error('Erro ao pagar com saldo:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno ao processar o pagamento.' });
    }
};

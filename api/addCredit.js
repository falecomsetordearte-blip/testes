// /api/addCredit.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

// Função auxiliar para encontrar o contato pelo token de sessão
// (Isso evita repetir código que já existe em outras partes do seu projeto)
async function findUserByToken(token) {
    const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
        filter: {
            'UF_CRM_1751824225': token, // Campo que armazena os tokens
        },
        select: ['ID', 'UF_CRM_1748911653'] // Seleciona a ID do contato e a ID do cliente Asaas
    });

    const user = searchUserResponse.data.result[0];
    return user;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    // Validação inicial das variáveis de ambiente
    if (!BITRIX24_API_URL || !ASAAS_API_URL || !ASAAS_API_KEY) {
        console.error("Erro Crítico: Variáveis de ambiente da API não configuradas.");
        return res.status(500).json({ message: 'Erro de configuração interna do servidor.' });
    }

    try {
        const { token, valor } = req.body;

        if (!token || !valor) {
            return res.status(400).json({ message: 'Token e valor são obrigatórios.' });
        }

        const valorNumerico = parseFloat(valor);
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
            return res.status(400).json({ message: 'O valor deve ser um número positivo.' });
        }

        // ETAPA 3: Encontrar o contato no Bitrix24
        const user = await findUserByToken(token);

        if (!user) {
            return res.status(404).json({ message: 'Sessão inválida ou usuário não encontrado.' });
        }

        // ETAPA 4: Obter a ID do cliente Asaas do campo customizado
        const asaasCustomerId = user.UF_CRM_1748911653;

        if (!asaasCustomerId) {
            return res.status(400).json({ message: 'Não foi possível encontrar a ID de cliente para pagamentos. Contate o suporte.' });
        }

        // ETAPA 5 e 6: Criar a cobrança no Asaas
        const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        
        const paymentData = {
            customer: asaasCustomerId,
            billingType: "UNDEFINED", // Permite que o cliente escolha PIX ou Cartão
            value: valorNumerico,
            dueDate: today,
            description: "Recarga de créditos - Setor de Arte",
            externalReference: "Créditos" // Referência para o webhook
        };

        const asaasResponse = await axios.post(`${ASAAS_API_URL}/payments`, paymentData, {
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY
            }
        });

        const invoiceUrl = asaasResponse.data.invoiceUrl;

        if (!invoiceUrl) {
            throw new Error('Asaas não retornou uma URL de pagamento.');
        }

        // ETAPA 7: Retornar a URL de pagamento para o frontend
        return res.status(200).json({ url: invoiceUrl });

    } catch (error) {
        console.error('Erro ao adicionar créditos:', error.response ? error.response.data : error.message);
        const errorMessage = error.response?.data?.errors?.[0]?.description || 'Ocorreu um erro ao gerar a cobrança. Tente novamente.';
        return res.status(500).json({ message: errorMessage });
    }
};

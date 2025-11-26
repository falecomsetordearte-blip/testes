// /api/instalacao-loja/concluir.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// ID da fase de destino (Concluído / Instalado)
const TARGET_STAGE_ID = 'C17:UC_GT7MVB';

module.exports = async (req, res) => {
    // Apenas método POST é permitido
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, dealId } = req.body;

        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        // ------------------------------------------------------------------
        // 1. Validar Token e Identificar Empresa (Segurança)
        // ------------------------------------------------------------------
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userSearch.data.result ? userSearch.data.result[0] : null;

        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // ------------------------------------------------------------------
        // 2. Verificar se o Deal pertence à empresa do usuário
        // ------------------------------------------------------------------
        // Isso evita que um usuário manipule pedidos de outra loja
        const dealCheck = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, {
            id: dealId
        });

        const deal = dealCheck.data.result;

        if (!deal) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // Comparação (usando == para evitar problemas de string vs numero)
        if (deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Você não tem permissão para alterar este pedido.' });
        }

        // ------------------------------------------------------------------
        // 3. Atualizar a fase do pedido no Bitrix
        // ------------------------------------------------------------------
        const updateResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
            id: dealId,
            fields: {
                'STAGE_ID': TARGET_STAGE_ID
            }
        });

        if (updateResponse.data.result) {
            return res.status(200).json({ 
                success: true, 
                message: 'Instalação concluída com sucesso.',
                movedToStage: TARGET_STAGE_ID
            });
        } else {
            throw new Error('O Bitrix não retornou confirmação de sucesso.');
        }

    } catch (error) {
        console.error('Erro ao concluir instalação:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro ao processar a conclusão do pedido.' });
    }
};
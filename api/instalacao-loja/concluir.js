// /api/instalacao-loja/concluir.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// ID da fase de destino CORRIGIDO (Finalizado/Entregue)
const TARGET_STAGE_ID = 'C17:UC_IKPW6X';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, dealId } = req.body;
        if (!sessionToken || !dealId) return res.status(400).json({ message: 'Dados incompletos.' });

        // 1. Validar Usuário
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });
        const user = userSearch.data.result ? userSearch.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(401).json({ message: 'Sessão inválida.' });

        // 2. Validar Pedido
        const dealCheck = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealCheck.data.result;
        if (!deal) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (deal.COMPANY_ID != user.COMPANY_ID) return res.status(403).json({ message: 'Acesso negado.' });

        // 3. Atualizar Fase
        const updateResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
            id: dealId,
            fields: { 'STAGE_ID': TARGET_STAGE_ID }
        });

        if (updateResponse.data.result) {
            return res.status(200).json({ success: true, message: 'Instalação na loja concluída.' });
        } else {
            throw new Error('Falha no Bitrix.');
        }

    } catch (error) {
        console.error('Erro Instalação Loja:', error);
        return res.status(500).json({ message: 'Erro ao concluir.' });
    }
};
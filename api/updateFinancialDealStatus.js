// /api/updateFinancialDealStatus.js - COMPLETO

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// --- CONFIGURAÇÃO DOS DESTINOS ---
const STAGE_PAGO   = 'C17:UC_WFTT1A';
const STAGE_COBRAR = 'C17:UC_G2024K'; // ID Atualizado

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        const { sessionToken, dealId, acao } = req.body; 
        // acao esperamos: 'PAGO' ou 'DEVEDOR'

        if (!sessionToken || !dealId || !acao) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        // 1. Validar Sessão
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });
        const user = userCheck.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        // 2. Verificar Posse do Deal (Segurança)
        const dealCheck = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, { id: dealId });
        const deal = dealCheck.data.result;
        
        if (!deal) return res.status(404).json({ message: 'Pedido não encontrado.' });
        
        if (deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado. Pedido pertence a outra empresa.' });
        }

        // 3. Definir Novo Estágio
        let novoStageId = '';
        
        if (acao === 'PAGO') {
            novoStageId = STAGE_PAGO;
        } else if (acao === 'DEVEDOR') {
            novoStageId = STAGE_COBRAR;
        } else {
            return res.status(400).json({ message: 'Ação inválida. Use PAGO ou DEVEDOR.' });
        }

        console.log(`Movendo Deal ${dealId} para ${novoStageId} (Ação: ${acao})`);

        // 4. Atualizar Bitrix
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: { 'STAGE_ID': novoStageId }
        });

        return res.status(200).json({ message: 'Status atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro updateFinancialDealStatus:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
};
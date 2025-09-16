// /api/getPanelData.js - VERSÃO COM FILTRO DE STAGES ADICIONADO

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { token: sessionToken } = req.body;
        if (!sessionToken) {
            return res.status(400).json({ message: 'Token de sessão é obrigatório.' });
        }

        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result[0];
        if (!user) {
            return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
        }
        
        let saldoDaEmpresa = 0;
        if (user.COMPANY_ID) {
            const companyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, {
                id: user.COMPANY_ID
            });
            const company = companyResponse.data.result;
            if (company) {
                saldoDaEmpresa = company['UF_CRM_1751913325'] || 0;
            }
        }
        
        // --- ALTERAÇÃO APLICADA AQUI ---
        // Adicionamos a condição '!STAGE_ID' ao filtro para excluir os estágios indesejados.
        const dealsResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: {
                'COMPANY_ID': user.COMPANY_ID,
                'CATEGORY_ID': 17, // Filtra apenas para o pipeline de arte
                '!STAGE_ID': [
                    'C17:UC_ZHMX6W', // Stage de Impressão
                    'C11:UC_YYHPKI', // Stage Financeiro
                    'C17:UC_ZPMNF9'  // Stage de Acabamento Concluído
                ]
            },
            // --- FIM DA ALTERAÇÃO ---
            order: { 'ID': 'DESC' },
            select: [
                'ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'COMMENTS',
                'UF_CRM_1755374245504',
                'UF_CRM_1755374266027'
            ]
        });

        let pedidos = dealsResponse.data.result || [];
        
        pedidos = pedidos.map(pedido => {
            let temNotificacao = false;
            const msgDesigner = pedido.UF_CRM_1755374266027;
            const msgCliente = pedido.UF_CRM_1755374245504;
            
            if (msgDesigner && msgCliente) {
                if (new Date(msgDesigner) > new Date(msgCliente)) {
                    temNotificacao = true;
                }
            } else if (msgDesigner) {
                temNotificacao = true;
            }
            
            return {
                ID: pedido.ID,
                TITLE: pedido.TITLE,
                STAGE_ID: pedido.STAGE_ID,
                OPPORTUNITY: parseFloat(pedido.OPPORTUNITY || 0) / 0.9,
                COMMENTS: pedido.COMMENTS,
                notificacao: temNotificacao
            };
        });

        return res.status(200).json({
            status: 'success',
            saldo: saldoDaEmpresa,
            pedidos: pedidos
        });

    } catch (error) {
        console.error('Erro ao carregar dados do painel:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os dados do painel.' });
    }
};
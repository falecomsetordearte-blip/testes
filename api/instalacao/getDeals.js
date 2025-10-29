// /api/instalacao/getDeals.js

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Campos que queremos buscar do Bitrix24 (pode ajustar se precisar de outros)
const REQUIRED_FIELDS = [
    'ID', 'TITLE', 'COMPANY_ID',
    'UF_CRM_1741273407628', // NOME_CLIENTE_FIELD
    'UF_CRM_1749481565243', // CONTATO_CLIENTE_FIELD
    'UF_CRM_1752712769666', // LINK_ATENDIMENTO_FIELD
    'UF_CRM_1727464924690', // MEDIDAS_FIELD
    'UF_CRM_1748277308731', // LINK_ARQUIVO_FINAL_FIELD
    'UF_CRM_1757794109'      // PRAZO_FINAL_FIELD
];

// 
// TODO: VOCÊ PRECISA CRIAR ESTE CAMPO NO BITRIX24!
// Crie um campo de "Lista" no Negócio chamado "Status da Instalação" 
// e coloque o ID dele aqui. Ex: 'UF_CRM_123456789'
//
const FIELD_STATUS_INSTALACAO = 'UF_CRM_NOVO_CAMPO_STATUS_INSTALACAO'; 
REQUIRED_FIELDS.push(FIELD_STATUS_INSTALACAO);


module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(401).json({ message: 'Acesso não autorizado. Token de sessão é obrigatório.' });
        }

        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }

        //
        // TODO: CONFIRME ESTE STAGE_ID!
        // Este deve ser o ID da etapa onde os negócios aguardando instalação ficam.
        // Eu assumi que é a etapa de "Acabamento" ('C17:UC_QA8TN5'). Se for outra, troque aqui.
        //
        const filterParams = {
            'STAGE_ID': 'C17:UC_QA8TN5', 
            'COMPANY_ID': user.COMPANY_ID
        };

        console.log('[getDeals Instalação] Iniciando busca com os filtros:', JSON.stringify(filterParams));

        const response = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: filterParams,
            order: { 'ID': 'DESC' },
            select: REQUIRED_FIELDS
        });

        const deals = response.data.result || [];
        
        console.log(`[getDeals Instalação] ${deals.length} negócios encontrados para a empresa ${user.COMPANY_ID}.`);
        
        return res.status(200).json({ deals: deals });

    } catch (error) {
        console.error('[getDeals Instalação] Erro:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados de instalação.' });
    }
};
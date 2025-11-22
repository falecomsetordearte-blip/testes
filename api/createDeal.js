// /api/createDeal.js - VERSÃO COM DEPURAÇÃO DETALHADA

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_IMPRESSORA = 'UF_CRM_1658470569';
const FIELD_MATERIAL = 'UF_CRM_1685624742';
const FIELD_TIPO_ENTREGA = 'UF_CRM_1658492661';

module.exports = async (req, res) => {
    console.log("--- INICIANDO FUNÇÃO /api/createDeal ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, impressoraId, materialId, tipoEntregaId, ...formData } = req.body;
        console.log("Dados recebidos do formulário:", { ...formData, impressoraId, materialId, tipoEntregaId });

        // PONTO DE VERIFICAÇÃO 1: Encontrar o contato e a company
        console.log("Buscando usuário com o token de sessão...");
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result[0];
        
        if (!user) {
            console.error("ERRO: Nenhum usuário encontrado com o token fornecido.");
            return res.status(401).json({ message: 'Sessão inválida.' });
        }
        
        // PONTO DE VERIFICAÇÃO 2: Logar os dados do usuário e da company
        console.log(`Usuário encontrado: ID ${user.ID}, Nome: ${user.NAME}`);
        console.log(`ID da Empresa associada: ${user.COMPANY_ID}`);

        if (!user.COMPANY_ID) {
            console.error("ERRO: O usuário encontrado não está associado a nenhuma empresa (COMPANY_ID está nulo).");
            return res.status(400).json({ message: 'Usuário não associado a uma empresa.' });
        }

        const companyId = user.COMPANY_ID;
        const opportunityValue = parseFloat(formData.valorDesigner) * 0.8;

        const dealFields = {
            'TITLE': formData.titulo,
            'OPPORTUNITY': opportunityValue.toFixed(2),
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': companyId,
            'CATEGORY_ID': 17,
            'STAGE_ID': 'C17:NEW',
            [FIELD_BRIEFING_COMPLETO]: formData.briefingFormatado,
            [FIELD_NOME_CLIENTE]: formData.nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: formData.wppCliente,
            [FIELD_IMPRESSORA]: impressoraId,
            [FIELD_MATERIAL]: materialId,
            [FIELD_TIPO_ENTREGA]: tipoEntregaId,
        };

        // PONTO DE VERIFICAÇÃO 3: Logar o objeto exato que será enviado para o Bitrix24
        console.log("Objeto de dados que será enviado para crm.deal.add:", JSON.stringify({ fields: dealFields }, null, 2));

        // PONTO DE VERIFICAÇÃO 4: Criar o Negócio
        console.log("Enviando requisição para criar o negócio...");
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });
        
        console.log("Resposta do Bitrix24 (crm.deal.add):", createDealResponse.data);

        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            throw new Error('Falha ao criar o negócio no Bitrix24. A resposta não continha um ID de negócio.');
        }

        console.log(`--- SUCESSO! Negócio criado com ID: ${newDealId} ---`);
        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        // PONTO DE VERIFICAÇÃO 5: Capturar e logar o erro exato da API
        console.error("--- OCORREU UM ERRO DURANTE A EXECUÇÃO ---");
        if (error.response) {
            // Este é o log mais importante se uma chamada da API falhar
            console.error("ERRO DETALHADO DO BITRIX24:", JSON.stringify(error.response.data, null, 2));
        } else {
            // Erro de rede ou outro problema
            console.error("Erro geral:", error.message);
        }
        return res.status(500).json({ message: 'Ocorreu um erro interno ao criar o pedido.' });
    }
};
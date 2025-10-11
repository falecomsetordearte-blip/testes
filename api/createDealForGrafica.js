import { PrismaClient } from '@prisma/client';
const axios = require('axios');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados (incluindo os novos)
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_WHATSAPP_GRAFICA = 'UF_CRM_1760171265'; // NOVO
const FIELD_LOGO_ID = 'UF_CRM_1760171060';         // NOVO

export default async function handler(req, res) {
    console.log("--- INICIANDO FUNÇÃO /api/createDealForGrafica ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // 1. Extrair todos os dados, incluindo o novo WhatsApp da Gráfica
        const { sessionToken, graficaWpp, ...formData } = req.body;
        console.log("Dados recebidos:", { sessionToken, graficaWpp, ...formData });

        if (!graficaWpp) {
            return res.status(400).json({ message: 'O WhatsApp da Gráfica é obrigatório.' });
        }

        // 2. Buscar a empresa no banco de dados usando o WhatsApp da Gráfica
        console.log(`Buscando empresa com WhatsApp: ${graficaWpp}`);
        const empresa = await prisma.empresa.findFirst({
            where: {
                whatsapp: graficaWpp,
            },
        });

        if (!empresa) {
            console.error(`ERRO: Nenhuma empresa encontrada com o WhatsApp ${graficaWpp}.`);
            return res.status(404).json({ message: `Nenhuma empresa encontrada com o WhatsApp ${graficaWpp}.` });
        }

        const logoId = empresa.logo;
        console.log(`Empresa encontrada: ${empresa.nome_fantasia}, ID do Logo: ${logoId}`);

        // 3. Lógica original para encontrar o usuário/contato no Bitrix24
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
        if (!user.COMPANY_ID) {
            console.error("ERRO: O usuário encontrado não está associado a nenhuma empresa.");
            return res.status(400).json({ message: 'Usuário não associado a uma empresa.' });
        }

        // 4. Montar o objeto do Deal com os campos adicionais
        const opportunityValue = parseFloat(formData.valorDesigner) * 0.9;
        const dealFields = {
            'TITLE': formData.titulo,
            'OPPORTUNITY': opportunityValue.toFixed(2),
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': user.COMPANY_ID,
            'CATEGORY_ID': 17,
            'STAGE_ID': 'C17:NEW',
            [FIELD_BRIEFING_COMPLETO]: formData.briefingFormatado,
            [FIELD_NOME_CLIENTE]: formData.nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: formData.wppCliente,
            [FIELD_WHATSAPP_GRAFICA]: graficaWpp, // Campo novo
            [FIELD_LOGO_ID]: logoId,             // Campo novo
        };

        console.log("Enviando dados para criar o negócio no Bitrix24:", dealFields);
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });
        
        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            throw new Error('Falha ao criar o negócio no Bitrix24.');
        }

        console.log(`--- SUCESSO! Negócio criado com ID: ${newDealId} ---`);
        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("--- OCORREU UM ERRO DURANTE A EXECUÇÃO ---");
        if (error.response) {
            console.error("ERRO DETALHADO DO BITRIX24:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Erro geral:", error.message);
        }
        return res.status(500).json({ message: error.message || 'Ocorreu um erro interno ao criar o pedido.' });
    }
}
// /api/createDealForGrafica.js - VERSÃO CORRIGIDA E COMPLETA

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = require('../lib/prisma');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_WHATSAPP_GRAFICA = 'UF_CRM_1760171265';
const FIELD_LOGO_ID = 'UF_CRM_1760171060';
const FIELD_SERVICO = 'UF_CRM_1761123161542';

module.exports = async (req, res) => {
    console.log("--- INICIANDO FUNÇÃO /api/createDealForGrafica ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, graficaWpp, servico, ...formData } = req.body;
        console.log("Dados recebidos:", { sessionToken, graficaWpp, servico, ...formData });

        if (!graficaWpp) {
            return res.status(400).json({ message: 'O WhatsApp da Gráfica é obrigatório.' });
        }
        if (!servico) {
             return res.status(400).json({ message: 'O campo Serviço é obrigatório.' });
        }

        const wppLimpo = graficaWpp.replace(/\D/g, '');

        // --- INÍCIO DA CORREÇÃO ---
        // Em vez de buscar por um valor exato, buscamos todas as empresas
        // e filtramos na aplicação. Isso torna a busca resiliente a dados
        // mal formatados (com espaços, hífens, etc.) no banco de dados.
        // ATENÇÃO: Para tabelas com muitas empresas, essa abordagem pode ser lenta.
        // A solução ideal a longo prazo é garantir que todos os WhatsApps no banco
        // sejam salvos sem formatação.

        console.log(`Buscando em todas as empresas por um WhatsApp correspondente a: ${wppLimpo}`);
        const todasEmpresas = await prisma.empresa.findMany();
        const empresa = todasEmpresas.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);
        // --- FIM DA CORREÇÃO ---

        if (!empresa) {
            console.error(`ERRO: Nenhuma empresa encontrada com o WhatsApp ${graficaWpp}.`);
            return res.status(404).json({ message: `Nenhuma empresa encontrada com o WhatsApp ${graficaWpp}.` });
        }

        const logoId = empresa.logo;
        
        const valorIntegral = parseFloat(formData.valorDesigner);
        const opportunityValue = valorIntegral * 0.8;
        
        if (isNaN(valorIntegral)) {
            return res.status(400).json({ message: 'O valor para o Designer deve ser um número válido.' });
        }
        
        console.log(`Empresa encontrada: ${empresa.nome_fantasia}. Valor Integral: ${valorIntegral}. Valor Opportunity: ${opportunityValue}`);

        console.log(`Atualizando saldo devedor para a empresa ID: ${empresa.id}`);
        
        await prisma.empresa.update({
            where: {
                id: empresa.id,
            },
            data: {
                saldo_devedor: {
                    increment: valorIntegral,
                },
            },
        });
        
        console.log("Saldo devedor atualizado com sucesso no banco de dados.");

        // Lógica para encontrar o usuário/contato no Bitrix24 continua normalmente
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(400).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }

        // Montar o objeto do Deal para o Bitrix24
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
            [FIELD_WHATSAPP_GRAFICA]: graficaWpp,
            [FIELD_LOGO_ID]: logoId,
            [FIELD_SERVICO]: servico,
        };

        // Enviar requisição para criar o negócio no Bitrix24
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });
        
        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            throw new Error('Falha ao criar o negócio no Bitrix24.');
        }

        // Retornar sucesso
        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("--- OCORREU UM ERRO DURANTE A EXECUÇÃO ---");
        if (error.response) {
            console.error("ERRO DETALHADO DA API EXTERNA:", JSON.stringify(error.response.data, null, 2));
        } else if (error.code) { 
             console.error("ERRO DO PRISMA:", error.message, "CÓDIGO:", error.code);
        }
        else {
            console.error("Erro geral:", error.message);
        }
        
        return res.status(500).json({ message: error.message || 'Ocorreu um erro interno ao criar o pedido.' });
    }
};
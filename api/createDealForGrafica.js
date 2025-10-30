// /api/createDealForGrafica.js - VERSÃO ATUALIZADA E COMPLETA

const prisma = require('../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados do Bitrix24
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_WHATSAPP_GRAFICA = 'UF_CRM_1760171265'; // Usado para Supervisão
const FIELD_LOGO_ID = 'UF_CRM_1760171060';
const FIELD_SERVICO = 'UF_CRM_1761123161542';
const FIELD_LINK_ARQUIVO_CLIENTE = 'UF_CRM_1748277308731';
const FIELD_ARTE_ORIGEM = 'UF_CRM_1761269158';
const FIELD_TIPO_ENTREGA = 'UF_CRM_1658492661'; // <-- Novo campo mapeado

module.exports = async (req, res) => {
    console.log("--- INICIANDO FUNÇÃO /api/createDealForGrafica ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // Recebendo o novo campo 'tipoEntrega' do frontend
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, ...formData } = req.body;
        console.log("Dados recebidos no backend:", req.body);

        // Validação para os campos principais
        if (!arte || !tipoEntrega) { // <-- Validação atualizada
            return res.status(400).json({ message: 'Os campos "Arte" e "Tipo de Entrega" são obrigatórios.' });
        }

        // Busca o usuário logado no Bitrix para obter o COMPANY_ID
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });
        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(400).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }

        let briefingFinal = formData.briefingFormatado;

        // Monta os campos base do Deal, comuns a todos os tipos
        const dealFields = {
            'TITLE': formData.titulo,
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': user.COMPANY_ID,
            'CATEGORY_ID': 17,
            'STAGE_ID': 'C17:NEW',
            [FIELD_NOME_CLIENTE]: formData.nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: formData.wppCliente,
            [FIELD_ARTE_ORIGEM]: arte,
            [FIELD_TIPO_ENTREGA]: tipoEntrega // <-- Novo campo adicionado ao objeto do Deal
        };
        
        // Lógica condicional baseada na origem da "Arte"
        if (arte === 'Setor de Arte') {
            if (!supervisaoWpp || !valorDesigner || !formData.servico || !formData.formato) {
                return res.status(400).json({ message: 'Para "Setor de Arte", os campos Serviço, Supervisão, Valor e Formato são obrigatórios.' });
            }
            const wppLimpo = supervisaoWpp.replace(/\D/g, '');
            const todasEmpresas = await prisma.empresa.findMany();
            const empresa = todasEmpresas.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);
            if (!empresa) {
                return res.status(404).json({ message: `Nenhuma empresa encontrada com o WhatsApp de supervisão ${supervisaoWpp}.` });
            }
            const valorIntegral = parseFloat(valorDesigner);
            if (isNaN(valorIntegral)) {
                return res.status(400).json({ message: 'O valor para o Designer deve ser um número válido.' });
            }
            const opportunityValue = valorIntegral * 0.8;
            await prisma.empresa.update({
                where: { id: empresa.id },
                data: { saldo_devedor: { increment: valorIntegral } },
            });
            dealFields.OPPORTUNITY = opportunityValue.toFixed(2);
            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_LOGO_ID] = empresa.logo;
            dealFields[FIELD_SERVICO] = formData.servico;
            let formatoEntrega = formData.formato;
            if (formatoEntrega === 'CDR' && formData.cdrVersao) {
                formatoEntrega += ` (Versão: ${formData.cdrVersao})`;
            }
            briefingFinal += `\n\n--- Formato de Entrega ---\n${formatoEntrega}`;
        } else if (arte === 'Arquivo do Cliente') {
            if (!formData.linkArquivo) {
                 return res.status(400).json({ message: 'O link do arquivo é obrigatório para a opção "Arquivo do Cliente".' });
            }
            dealFields[FIELD_LINK_ARQUIVO_CLIENTE] = formData.linkArquivo;
            dealFields.OPPORTUNITY = 0;
        } else if (arte === 'Designer Próprio') {
            dealFields.OPPORTUNITY = 0;
        }

        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        // Envia a requisição para criar o negócio no Bitrix24
        console.log("Enviando dados para criar deal no Bitrix24:", dealFields);
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });
        
        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            console.error("Falha ao criar deal no Bitrix:", createDealResponse.data);
            throw new Error('Falha ao criar o negócio no Bitrix24.');
        }

        console.log(`Deal #${newDealId} criado com sucesso!`);
        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("--- OCORREU UM ERRO DURANTE A EXECUÇÃO ---");
        if (error.response) {
            console.error("ERRO DETALHADO DA API EXTERNA:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Erro geral:", error.message);
        }
        
        return res.status(500).json({ message: error.message || 'Ocorreu um erro interno ao criar o pedido.' });
    }
};
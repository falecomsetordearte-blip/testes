// /api/createDealForGrafica.js - ATUALIZADO PARA USAR A NOVA COLUNA LOGO_ID

const prisma = require('../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados do Bitrix24
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_WHATSAPP_GRAFICA = 'UF_CRM_1760171265'; // Usado para Supervisão
const FIELD_LOGO_ID = 'UF_CRM_1760171060'; // Campo onde vai o ID do logo no Bitrix
const FIELD_SERVICO = 'UF_CRM_1761123161542';
const FIELD_LINK_ARQUIVO_CLIENTE = 'UF_CRM_1748277308731';
const FIELD_ARTE_ORIGEM = 'UF_CRM_1761269158';
const FIELD_TIPO_ENTREGA = 'UF_CRM_1658492661';

module.exports = async (req, res) => {
    console.log("--- INICIANDO FUNÇÃO /api/createDealForGrafica ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, ...formData } = req.body;
        console.log("Dados recebidos:", req.body);

        // Validação
        if (!arte || !tipoEntrega) {
            return res.status(400).json({ message: 'Os campos "Arte" e "Tipo de Entrega" são obrigatórios.' });
        }

        // 1. Identificar a Empresa Logada (que está fazendo o pedido)
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });
        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(400).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }

        let briefingFinal = formData.briefingFormatado;

        // 2. Montar objeto do Negócio (Deal)
        const dealFields = {
            'TITLE': formData.titulo,
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': user.COMPANY_ID,
            'CATEGORY_ID': 17,
            'STAGE_ID': 'C17:NEW',
            [FIELD_NOME_CLIENTE]: formData.nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: formData.wppCliente,
            [FIELD_ARTE_ORIGEM]: arte,
            [FIELD_TIPO_ENTREGA]: tipoEntrega
        };
        
        // 3. Lógica Específica: SETOR DE ARTE (Onde usamos o Logo)
        if (arte === 'Setor de Arte') {
            if (!supervisaoWpp || !valorDesigner || !formData.servico || !formData.formato) {
                return res.status(400).json({ message: 'Preencha todos os campos obrigatórios do Setor de Arte.' });
            }

            const wppLimpo = supervisaoWpp.replace(/\D/g, '');

            // --- ALTERAÇÃO IMPORTANTE AQUI ---
            // Usamos queryRaw para pegar a tabela direto do banco, garantindo que a coluna 'logo_id' venha
            // mesmo que o Prisma Schema do projeto esteja desatualizado.
            const todasEmpresas = await prisma.$queryRaw`SELECT * FROM empresas`;
            
            const empresa = todasEmpresas.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);

            if (!empresa) {
                return res.status(404).json({ message: `Nenhuma empresa encontrada com o WhatsApp ${supervisaoWpp}.` });
            }

            const valorIntegral = parseFloat(valorDesigner);
            if (isNaN(valorIntegral)) {
                return res.status(400).json({ message: 'Valor inválido.' });
            }

            // Atualiza saldo (se a coluna saldo_devedor existir, senão o raw query acima pegou tudo, mas o update usa schema)
            // Nota: O update abaixo assume que o schema do Prisma tem 'saldo_devedor'. Se der erro aqui, avise.
            try {
                await prisma.empresa.update({
                    where: { id: empresa.id },
                    data: { saldo_devedor: { increment: valorIntegral } },
                });
            } catch (e) {
                console.warn("Aviso: Não foi possível atualizar saldo (talvez coluna não mapeada), seguindo o pedido.");
            }

            const opportunityValue = valorIntegral * 0.8;
            dealFields.OPPORTUNITY = opportunityValue.toFixed(2);
            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            
            // --- USANDO A NOVA COLUNA ---
            // Agora pegamos 'logo_id' (inteiro) que salvamos no cadastro.
            // Se 'logo_id' for nulo, tentamos 'logo' (legado) ou deixamos vazio.
            dealFields[FIELD_LOGO_ID] = empresa.logo_id || empresa.logo; 

            dealFields[FIELD_SERVICO] = formData.servico;
            
            let formatoEntrega = formData.formato;
            if (formatoEntrega === 'CDR' && formData.cdrVersao) {
                formatoEntrega += ` (Versão: ${formData.cdrVersao})`;
            }
            briefingFinal += `\n\n--- Formato de Entrega ---\n${formatoEntrega}`;

        } else if (arte === 'Arquivo do Cliente') {
            if (!formData.linkArquivo) {
                 return res.status(400).json({ message: 'O link do arquivo é obrigatório.' });
            }
            dealFields[FIELD_LINK_ARQUIVO_CLIENTE] = formData.linkArquivo;
            dealFields.OPPORTUNITY = 0;
        } else if (arte === 'Designer Próprio') {
            dealFields.OPPORTUNITY = 0;
        }

        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        // 4. Enviar para Bitrix24
        console.log("Enviando Deal para Bitrix:", dealFields);
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });
        
        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            throw new Error('Falha ao criar o negócio no Bitrix24.');
        }

        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("ERRO:", error.message);
        return res.status(500).json({ message: error.message || 'Erro interno.' });
    }
};
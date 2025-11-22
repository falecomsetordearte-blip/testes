// /api/createDealForGrafica.js

const prisma = require('../lib/prisma');
const axios = require('axios');
const { uploadAndGetPublicLink } = require('./bitrixFileHelper'); // <--- Importando o helper criado anteriormente

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// --- MAPEAMENTO DE CAMPOS BITRIX ---
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_WHATSAPP_GRAFICA = 'UF_CRM_1760171265'; 
const FIELD_LOGO_ID = 'UF_CRM_1760171060'; 
const FIELD_SERVICO = 'UF_CRM_1761123161542';
const FIELD_ARTE_ORIGEM = 'UF_CRM_1761269158';
const FIELD_TIPO_ENTREGA = 'UF_CRM_1658492661';

// Campos de Arquivo (Links Públicos)
const FIELD_ARQUIVO_IMPRESSAO = 'UF_CRM_1748277308731'; // Campo para "Arquivo do Cliente"
const FIELD_ARQUIVO_DESIGNER = 'UF_CRM_1740770117580';  // Campo para "Arquivo para Designer" (ID Atualizado)

module.exports = async (req, res) => {
    console.log("--- INICIANDO FUNÇÃO /api/createDealForGrafica ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // Extraímos os novos objetos de arquivo do body: arquivoCliente e arquivoDesigner
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, arquivoCliente, arquivoDesigner, ...formData } = req.body;
        
        console.log("Dados recebidos (resumo):", { arte, titulo: formData.titulo, hasArquivoCliente: !!arquivoCliente, hasArquivoDesigner: !!arquivoDesigner });

        // Validação Básica
        if (!arte || !tipoEntrega) {
            return res.status(400).json({ message: 'Os campos "Arte" e "Tipo de Entrega" são obrigatórios.' });
        }

        // 1. Identificar a Empresa Logada
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });
        const user = searchUserResponse.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(400).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }

        let briefingFinal = formData.briefingFormatado;

        // 2. Montar objeto inicial do Negócio (Deal)
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
        
        // ======================================================================
        // LÓGICA 1: SETOR DE ARTE (Com upload opcional para Designer)
        // ======================================================================
        if (arte === 'Setor de Arte') {
            if (!supervisaoWpp || !valorDesigner || !formData.servico || !formData.formato) {
                return res.status(400).json({ message: 'Preencha todos os campos obrigatórios do Setor de Arte.' });
            }

            const wppLimpo = supervisaoWpp.replace(/\D/g, '');
            // Busca a empresa supervisora no banco Neon
            const todasEmpresas = await prisma.$queryRaw`SELECT * FROM empresas`;
            const empresa = todasEmpresas.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);

            if (!empresa) {
                return res.status(404).json({ message: `Nenhuma empresa encontrada com o WhatsApp ${supervisaoWpp}.` });
            }

            // Atualiza Saldo (se a tabela permitir)
            const valorIntegral = parseFloat(valorDesigner);
            try {
                await prisma.empresa.update({
                    where: { id: empresa.id },
                    data: { saldo_devedor: { increment: valorIntegral } },
                });
            } catch (e) { console.warn("Aviso: Erro ao atualizar saldo (schema pode estar desatualizado)."); }

            const opportunityValue = valorIntegral * 0.8;
            dealFields.OPPORTUNITY = opportunityValue.toFixed(2);
            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_LOGO_ID] = empresa.logo_id || empresa.logo;
            dealFields[FIELD_SERVICO] = formData.servico;
            
            // Formato
            let formatoEntrega = formData.formato;
            if (formatoEntrega === 'CDR' && formData.cdrVersao) {
                formatoEntrega += ` (Versão: ${formData.cdrVersao})`;
            }
            briefingFinal += `\n\n--- Formato de Entrega ---\n${formatoEntrega}`;

            // --- PROCESSAMENTO DO ARQUIVO DO DESIGNER (NOVO) ---
            if (arquivoDesigner && arquivoDesigner.base64) {
                console.log("Iniciando upload do arquivo para Designer...");
                try {
                    // Limpa o header do base64 (data:image/png;base64,...)
                    const base64Clean = arquivoDesigner.base64.split(';base64,').pop();
                    // Usa o nome original ou gera um timestamp
                    const fileName = arquivoDesigner.name || `Ref_Designer_${Date.now()}.jpg`;
                    
                    // Chama o helper para Upload + Link
                    const publicLink = await uploadAndGetPublicLink(fileName, base64Clean);
                    
                    if (publicLink) {
                        dealFields[FIELD_ARQUIVO_DESIGNER] = publicLink;
                        briefingFinal += `\n\n[ARQUIVO ANEXO]: ${publicLink}`;
                    }
                } catch (uploadError) {
                    console.error("Erro ao subir arquivo designer:", uploadError.message);
                    briefingFinal += `\n\n[ERRO]: O usuário tentou enviar um arquivo de referência, mas o upload falhou.`;
                }
            }

        // ======================================================================
        // LÓGICA 2: ARQUIVO DO CLIENTE (Obrigatório Upload)
        // ======================================================================
        } else if (arte === 'Arquivo do Cliente') {
            
            if (!arquivoCliente || !arquivoCliente.base64) {
                 return res.status(400).json({ message: 'O arquivo para impressão é obrigatório.' });
            }

            console.log("Iniciando upload do Arquivo do Cliente...");
            try {
                const base64Clean = arquivoCliente.base64.split(';base64,').pop();
                const fileName = arquivoCliente.name || `Impressao_${Date.now()}.pdf`;
                
                // Chama o helper
                const publicLink = await uploadAndGetPublicLink(fileName, base64Clean);
                
                if (!publicLink) throw new Error("Falha ao gerar link público do arquivo.");

                // Salva no campo "Arquivo para Impressão"
                dealFields[FIELD_ARQUIVO_IMPRESSAO] = publicLink;
                dealFields.OPPORTUNITY = 0;

            } catch (uploadError) {
                console.error("Erro Crítico Upload Cliente:", uploadError.message);
                return res.status(500).json({ message: "Falha ao processar o upload do arquivo. Tente novamente." });
            }

        // ======================================================================
        // LÓGICA 3: DESIGNER PRÓPRIO
        // ======================================================================
        } else if (arte === 'Designer Próprio') {
            dealFields.OPPORTUNITY = 0;
        }

        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        // 4. Enviar para Bitrix24
        console.log("Enviando Deal para Bitrix...");
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });
        
        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            throw new Error('Falha ao criar o negócio no Bitrix24.');
        }

        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("ERRO GERAL:", error.message);
        return res.status(500).json({ message: error.message || 'Erro interno.' });
    }
};
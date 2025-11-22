// /api/createDealForGrafica.js

const prisma = require('../lib/prisma');
const axios = require('axios');
const { uploadAndGetPublicLink } = require('./bitrixFileHelper');

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
const FIELD_ARQUIVO_IMPRESSAO = 'UF_CRM_1748277308731'; 
const FIELD_ARQUIVO_DESIGNER = 'UF_CRM_1740770117580'; 

module.exports = async (req, res) => {
    console.log("\n\n========================================================");
    console.log("[DEBUG] INICIANDO /api/createDealForGrafica");
    console.log("========================================================");

    // 1. CONFIGURAÇÃO DE CORS (CRÍTICO PARA EVITAR 403/CORS ERROR)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Se for preflight (OPTIONS), encerra aqui com sucesso
    if (req.method === 'OPTIONS') {
        console.log("[DEBUG] Respondendo requisição OPTIONS (CORS)");
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        console.error(`[ERRO] Método inválido: ${req.method}`);
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // 2. LOG DO PAYLOAD RECEBIDO (SEM TRAVAR COM BASE64 GIGANTE)
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, arquivoCliente, arquivoDesigner, ...formData } = req.body;
        
        console.log("[DEBUG] Passo 1: Payload recebido");
        console.log(`- Título: ${formData.titulo}`);
        console.log(`- Arte: ${arte}`);
        console.log(`- Token (início): ${sessionToken ? sessionToken.substring(0, 5) : 'NULO'}...`);
        console.log(`- Arquivo Cliente Presente? ${arquivoCliente ? 'SIM' : 'NÃO'} (Tamanho: ${arquivoCliente ? arquivoCliente.base64.length : 0} chars)`);
        console.log(`- Arquivo Designer Presente? ${arquivoDesigner ? 'SIM' : 'NÃO'}`);

        // Validação Básica
        if (!sessionToken) {
            console.error("[ERRO] Token de sessão ausente.");
            return res.status(403).json({ message: 'Sessão inválida (Token ausente).' });
        }
        if (!arte || !tipoEntrega) {
            console.error("[ERRO] Campos obrigatórios faltando.");
            return res.status(400).json({ message: 'Os campos "Arte" e "Tipo de Entrega" são obrigatórios.' });
        }

        // 3. AUTENTICAÇÃO NO BITRIX
        console.log("[DEBUG] Passo 2: Buscando usuário no Bitrix pelo Token...");
        const bitrixUrl = `${BITRIX24_API_URL}crm.contact.list.json`;
        
        const searchUserResponse = await axios.post(bitrixUrl, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });

        // Log detalhado da resposta do Bitrix
        if (!searchUserResponse.data || !searchUserResponse.data.result) {
            console.error("[ERRO BITRIX] Resposta inválida ao buscar usuário:", searchUserResponse.data);
            return res.status(500).json({ message: 'Erro ao validar usuário no CRM.' });
        }

        const user = searchUserResponse.data.result[0];
        
        if (!user) {
            console.error("[ERRO AUTH] Nenhum usuário encontrado com este token.");
            return res.status(403).json({ message: 'Sessão expirada ou inválida. Faça login novamente.' });
        }
        
        if (!user.COMPANY_ID) {
            console.error(`[ERRO AUTH] Usuário ${user.NAME} (ID: ${user.ID}) não tem Empresa vinculada.`);
            return res.status(403).json({ message: 'Usuário não está associado a uma empresa.' });
        }

        console.log(`[DEBUG] Usuário Autenticado: ${user.NAME} (ID: ${user.ID}, Empresa: ${user.COMPANY_ID})`);

        // 4. PREPARAÇÃO DO NEGÓCIO
        let briefingFinal = formData.briefingFormatado || '';

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

        // 5. PROCESSAMENTO ESPECÍFICO POR TIPO DE ARTE
        console.log(`[DEBUG] Passo 3: Processando lógica para: ${arte}`);

        // === CASO: SETOR DE ARTE ===
        if (arte === 'Setor de Arte') {
            if (!supervisaoWpp || !valorDesigner || !formData.servico || !formData.formato) {
                return res.status(400).json({ message: 'Preencha todos os campos obrigatórios do Setor de Arte.' });
            }

            const wppLimpo = supervisaoWpp.replace(/\D/g, '');
            console.log(`[DEBUG] Buscando empresa supervisora com WPP: ${wppLimpo}`);
            
            // Busca no Banco
            const todasEmpresas = await prisma.$queryRaw`SELECT * FROM empresas`;
            const empresa = todasEmpresas.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);

            if (!empresa) {
                console.error(`[ERRO] Empresa não encontrada para WPP ${wppLimpo}`);
                return res.status(404).json({ message: `Nenhuma empresa encontrada com o WhatsApp ${supervisaoWpp}.` });
            }
            console.log(`[DEBUG] Empresa Supervisora Encontrada: ${empresa.nome_fantasia} (ID: ${empresa.id})`);

            // Atualiza Saldo
            const valorIntegral = parseFloat(valorDesigner);
            try {
                console.log("[DEBUG] Atualizando saldo no banco...");
                await prisma.empresa.update({
                    where: { id: empresa.id },
                    data: { saldo_devedor: { increment: valorIntegral } },
                });
            } catch (e) { console.warn("[AVISO DB] Erro ao atualizar saldo (ignorado):", e.message); }

            const opportunityValue = valorIntegral * 0.8;
            dealFields.OPPORTUNITY = opportunityValue.toFixed(2);
            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_LOGO_ID] = empresa.logo_id || empresa.logo;
            dealFields[FIELD_SERVICO] = formData.servico;
            
            let formatoEntrega = formData.formato;
            if (formatoEntrega === 'CDR' && formData.cdrVersao) {
                formatoEntrega += ` (Versão: ${formData.cdrVersao})`;
            }
            briefingFinal += `\n\n--- Formato de Entrega ---\n${formatoEntrega}`;

            // UPLOAD DESIGNER
            if (arquivoDesigner && arquivoDesigner.base64) {
                console.log("[DEBUG] Iniciando Upload Arquivo Designer...");
                try {
                    const base64Clean = arquivoDesigner.base64.split(';base64,').pop();
                    const fileName = arquivoDesigner.name || `Ref_Designer_${Date.now()}.jpg`;
                    
                    const publicLink = await uploadAndGetPublicLink(fileName, base64Clean);
                    console.log(`[DEBUG] Link Gerado Designer: ${publicLink}`);
                    
                    if (publicLink) {
                        dealFields[FIELD_ARQUIVO_DESIGNER] = publicLink;
                        briefingFinal += `\n\n[ARQUIVO ANEXO]: ${publicLink}`;
                    }
                } catch (uploadError) {
                    console.error("[ERRO UPLOAD DESIGNER]", uploadError.message);
                    briefingFinal += `\n\n[ERRO]: Falha no upload da referência.`;
                }
            }

        // === CASO: ARQUIVO DO CLIENTE ===
        } else if (arte === 'Arquivo do Cliente') {
            console.log("[DEBUG] Lógica Arquivo Cliente");
            
            if (!arquivoCliente || !arquivoCliente.base64) {
                 console.error("[ERRO] Arquivo Cliente não enviado no payload.");
                 return res.status(400).json({ message: 'O arquivo para impressão é obrigatório.' });
            }

            console.log("[DEBUG] Iniciando Upload Arquivo Impressão...");
            try {
                const base64Clean = arquivoCliente.base64.split(';base64,').pop();
                const fileName = arquivoCliente.name || `Impressao_${Date.now()}.pdf`;
                
                // Helper
                const publicLink = await uploadAndGetPublicLink(fileName, base64Clean);
                console.log(`[DEBUG] Link Gerado Impressão: ${publicLink}`);
                
                if (!publicLink) throw new Error("Link retornado foi nulo.");

                dealFields[FIELD_ARQUIVO_IMPRESSAO] = publicLink;
                dealFields.OPPORTUNITY = 0;

            } catch (uploadError) {
                console.error("[ERRO CRÍTICO UPLOAD CLIENTE]", uploadError.message);
                if(uploadError.response) {
                    console.error("Detalhes Bitrix:", uploadError.response.data);
                }
                return res.status(500).json({ message: "Falha ao processar o upload do arquivo. Verifique se o arquivo não é muito grande." });
            }

        // === CASO: DESIGNER PRÓPRIO ===
        } else if (arte === 'Designer Próprio') {
            dealFields.OPPORTUNITY = 0;
        }

        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        // 6. ENVIO FINAL PARA O CRM
        console.log("[DEBUG] Passo 4: Enviando Deal para o Bitrix...");
        // console.log("Deal Fields:", JSON.stringify(dealFields, null, 2)); // Descomente se quiser ver o JSON final

        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });

        if (createDealResponse.data.error) {
            console.error("[ERRO API BITRIX]", createDealResponse.data.error_description);
            throw new Error(`Erro Bitrix: ${createDealResponse.data.error_description}`);
        }
        
        const newDealId = createDealResponse.data.result;
        console.log(`[SUCESSO] Negócio criado! ID: ${newDealId}`);

        if (!newDealId) {
            throw new Error('Bitrix não retornou o ID do negócio.');
        }

        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("\n[EXCEPTION CATCH]");
        console.error("Mensagem:", error.message);
        if (error.response) {
            console.error("Status Externo:", error.response.status);
            console.error("Dados Externos:", JSON.stringify(error.response.data, null, 2));
        }
        console.error("Stack:", error.stack);

        return res.status(500).json({ 
            message: error.message || 'Erro interno no servidor.',
            details: error.response ? error.response.data : null
        });
    }
};
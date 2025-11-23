const prisma = require('../lib/prisma');
const axios = require('axios');

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

// Campos de Link (URL direta)
const FIELD_ARQUIVO_IMPRESSAO = 'UF_CRM_1748277308731'; 
const FIELD_ARQUIVO_DESIGNER = 'UF_CRM_1740770117580'; 

module.exports = async (req, res) => {
    console.log("\n========================================================");
    console.log("[DEBUG] INICIANDO /api/createDealForGrafica");
    console.log("========================================================");

    // Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, linkArquivo, ...formData } = req.body;

        // Validação Básica
        if (!sessionToken) return res.status(403).json({ message: 'Sessão inválida.' });
        if (!arte || !tipoEntrega) return res.status(400).json({ message: 'Campos obrigatórios faltando.' });

        // ------------------------------------------------------------------
        // 1. AUTENTICAÇÃO E BUSCA DA EMPRESA NO NEON (CORRIGIDO)
        // ------------------------------------------------------------------
        console.log("[DEBUG] Passo 1: Autenticando usuário...");
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result ? searchUserResponse.data.result[0] : null;
        
        if (!user) return res.status(403).json({ message: 'Usuário não encontrado.' });
        if (!user.COMPANY_ID) return res.status(403).json({ message: 'Usuário Bitrix sem empresa vinculada.' });

        console.log(`[DEBUG] Usuário Bitrix OK. Company ID: ${user.COMPANY_ID}`);

        // --- CORREÇÃO AQUI ---
        // Agora buscamos na coluna 'bitrix_company_id' usando 'user.COMPANY_ID'
        const empresasLogadas = await prisma.$queryRaw`
            SELECT id 
            FROM empresas 
            WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} 
            LIMIT 1
        `;

        const empresaLogadaId = empresasLogadas.length > 0 ? empresasLogadas[0].id : null;

        if (empresaLogadaId) {
            console.log(`[DEBUG] Empresa Localizada no Neon ID: ${empresaLogadaId}`);
        } else {
            console.warn(`[ERRO CRÍTICO] Empresa ID Bitrix ${user.COMPANY_ID} não encontrada na tabela 'empresas' coluna 'bitrix_company_id'.`);
            // Se quiser bloquear o pedido caso não ache a empresa, descomente a linha abaixo:
            // return res.status(404).json({ message: 'Sua empresa não está cadastrada corretamente no banco de dados local.' });
        }

        // ------------------------------------------------------------------
        // 2. PREPARAÇÃO DO DEAL BITRIX
        // ------------------------------------------------------------------
        let briefingFinal = formData.briefingFormatado || '';
        
        // Variáveis para o banco de dados (histórico)
        let dbLinkImpressao = null;
        let dbLinkDesigner = null;

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

        // ------------------------------------------------------------------
        // 3. REGRAS DE NEGÓCIO
        // ------------------------------------------------------------------
        
        // === SETOR DE ARTE (FREELANCER) ===
        if (arte === 'Setor de Arte') {
            const wppLimpo = supervisaoWpp ? supervisaoWpp.replace(/\D/g, '') : '';
            
            // Busca Supervisor no Neon para debitar saldo (lógica mantida pelo WhatsApp)
            const todasEmpresas = await prisma.$queryRaw`SELECT * FROM empresas`;
            const supervisor = todasEmpresas.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);

            if (!supervisor) return res.status(404).json({ message: `Supervisor não encontrado (WPP: ${supervisaoWpp}).` });

            // Atualiza Saldo do Supervisor
            const valorFloat = parseFloat(valorDesigner);
            try {
                await prisma.empresa.update({
                    where: { id: supervisor.id },
                    data: { saldo_devedor: { increment: valorFloat } },
                });
            } catch (e) { console.warn("[DB] Erro update saldo:", e.message); }

            dealFields.OPPORTUNITY = (valorFloat * 0.8).toFixed(2);
            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_LOGO_ID] = supervisor.logo_id || supervisor.logo;
            dealFields[FIELD_SERVICO] = formData.servico;

            let formatoTexto = formData.formato;
            if (formatoTexto === 'CDR' && formData.cdrVersao) formatoTexto += ` (v${formData.cdrVersao})`;
            briefingFinal += `\n\n--- Formato ---\n${formatoTexto}`;
            
        // === ARQUIVO DO CLIENTE ===
        } else if (arte === 'Arquivo do Cliente') {
            if (linkArquivo) {
                dealFields[FIELD_ARQUIVO_IMPRESSAO] = linkArquivo;
                dbLinkImpressao = linkArquivo; 
            }
            dealFields.OPPORTUNITY = 0;

        // === DESIGNER PRÓPRIO ===
        } else {
            dealFields.OPPORTUNITY = 0;
        }

        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        // ------------------------------------------------------------------
        // 4. CRIAÇÃO NO BITRIX
        // ------------------------------------------------------------------
        console.log("[DEBUG] Criando Deal no Bitrix...");
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, { fields: dealFields });
        
        if (createDealResponse.data.error) throw new Error(createDealResponse.data.error_description);
        const newDealId = createDealResponse.data.result;

        // ------------------------------------------------------------------
        // 5. SALVAMENTO NO BANCO DE DADOS (TABELA PEDIDOS)
        // ------------------------------------------------------------------
        if (empresaLogadaId && newDealId) {
            console.log("[DEBUG] Salvando histórico na tabela 'pedidos'...");
            try {
                await prisma.$executeRaw`
                    INSERT INTO pedidos (
                        empresa_id,
                        bitrix_deal_id,
                        titulo,
                        nome_cliente,
                        whatsapp_cliente,
                        servico,
                        tipo_arte,
                        tipo_entrega,
                        whatsapp_supervisao,
                        valor_designer,
                        formato,
                        cdr_versao,
                        link_arquivo_impressao,
                        link_arquivo_designer,
                        briefing_completo
                    ) VALUES (
                        ${empresaLogadaId},
                        ${newDealId},
                        ${formData.titulo},
                        ${formData.nomeCliente},
                        ${formData.wppCliente},
                        ${formData.servico},
                        ${arte},
                        ${tipoEntrega},
                        ${supervisaoWpp || null},
                        ${valorDesigner ? parseFloat(valorDesigner) : null},
                        ${formData.formato || null},
                        ${formData.cdrVersao || null},
                        ${dbLinkImpressao},
                        ${dbLinkDesigner},
                        ${briefingFinal}
                    )
                `;
                console.log("[SUCESSO] Pedido salvo no Neon.");
            } catch (dbError) {
                console.error("[ERRO DB] Falha ao salvar na tabela pedidos:", dbError.message);
            }
        } else {
            console.warn("[AVISO] Pedido criado no Bitrix, mas NÃO SALVO no Neon (Empresa local não encontrada).");
        }

        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("[EXCEPTION]", error.message);
        return res.status(500).json({ message: error.message || 'Erro interno.' });
    }
};
// /api/createDealForGrafica.js

const prisma = require('../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const STAGE_FREELANCER = 'C17:NEW';         
const STAGE_CONFERENCIA = 'C17:UC_ZHMX6W';  
const STAGE_DESIGNER_PROPRIO = 'C17:UC_JHF0WH';

const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_WHATSAPP_GRAFICA = 'UF_CRM_1760171265'; 
const FIELD_LOGO_ID = 'UF_CRM_1760171060'; 
const FIELD_SERVICO = 'UF_CRM_1761123161542';
const FIELD_ARTE_ORIGEM = 'UF_CRM_1761269158';
const FIELD_TIPO_ENTREGA = 'UF_CRM_1658492661';
const FIELD_ARQUIVO_IMPRESSAO = 'UF_CRM_1748277308731'; 
const FIELD_ARQUIVO_DESIGNER = 'UF_CRM_1740770117580'; 
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';

module.exports = async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, linkArquivo, ...formData } = req.body;

        if (!sessionToken) return res.status(403).json({ message: 'Sessão inválida.' });
        if (!arte || !tipoEntrega) return res.status(400).json({ message: 'Campos obrigatórios faltando.' });

        // 1. Identificar Usuário/Empresa
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result ? searchUserResponse.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(403).json({ message: 'Usuário ou Empresa não identificados.' });

        // 2. Buscar Saldo
        const empresasLogadas = await prisma.$queryRaw`
            SELECT id, saldo FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1
        `;
        
        if (empresasLogadas.length === 0) return res.status(404).json({ message: 'Empresa não encontrada.' });

        const empresa = empresasLogadas[0];
        const empresaLogadaId = empresa.id;
        const saldoAtual = parseFloat(empresa.saldo || 0);

        // 3. Preparar Deal
        let briefingFinal = formData.briefingFormatado || '';
        let stageIdSelecionado = STAGE_CONFERENCIA;
        let valorOportunidade = 0;
        let dbLinkImpressao = null;
        let dbLinkDesigner = null;

        const dealFields = {
            'TITLE': formData.titulo,
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': user.COMPANY_ID,
            'CATEGORY_ID': 17,
            [FIELD_NOME_CLIENTE]: formData.nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: formData.wppCliente,
            [FIELD_ARTE_ORIGEM]: arte,
            [FIELD_TIPO_ENTREGA]: tipoEntrega
        };

        // --- VERIFICAÇÃO DE SALDO (Setor de Arte) ---
        if (arte === 'Setor de Arte') {
            stageIdSelecionado = STAGE_FREELANCER;
            const custoDesigner = parseFloat(valorDesigner || 0);

            // BLOQUEIO DE SALDO
            if (saldoAtual < custoDesigner) {
                const faltante = custoDesigner - saldoAtual;
                const faltanteFmt = faltante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                
                return res.status(400).json({ 
                    success: false,
                    message: `Adicione R$ ${faltanteFmt} em sua Carteira para o Freelancer atender esse Pedido e tente novamente.` 
                });
            }

            // Se tem saldo, continua...
            const wppLimpo = supervisaoWpp ? supervisaoWpp.replace(/\D/g, '') : '';
            const todosSupervisores = await prisma.$queryRaw`SELECT * FROM empresas`; 
            const supervisor = todosSupervisores.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);

            if (!supervisor) return res.status(404).json({ message: `Supervisor não encontrado.` });

            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_LOGO_ID] = supervisor.logo_id || supervisor.logo;
            dealFields[FIELD_SERVICO] = formData.servico;
            valorOportunidade = (custoDesigner * 0.8).toFixed(2);

            let formatoTexto = formData.formato;
            if (formatoTexto === 'CDR' && formData.cdrVersao) formatoTexto += ` (v${formData.cdrVersao})`;
            briefingFinal += `\n\n--- Formato ---\n${formatoTexto}`;

        } else if (arte === 'Arquivo do Cliente') {
            stageIdSelecionado = STAGE_CONFERENCIA;
            if (linkArquivo) { dealFields[FIELD_ARQUIVO_IMPRESSAO] = linkArquivo; dbLinkImpressao = linkArquivo; }
            valorOportunidade = 0;
        } else if (arte === 'Designer Próprio') {
            stageIdSelecionado = STAGE_DESIGNER_PROPRIO;
            valorOportunidade = 0;
        } else {
            stageIdSelecionado = STAGE_CONFERENCIA;
            valorOportunidade = 0;
        }

        dealFields['STAGE_ID'] = stageIdSelecionado;
        dealFields['OPPORTUNITY'] = valorOportunidade;
        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        // 4. Criação no Bitrix
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, { fields: dealFields });
        
        if (createDealResponse.data.error) throw new Error(createDealResponse.data.error_description);
        const newDealId = createDealResponse.data.result;

        // 5. Saldo e Banco Local
        if (newDealId) {
            try {
                if (arte === 'Setor de Arte') {
                    const valorDebito = parseFloat(valorDesigner || 0);
                    await prisma.$executeRaw`UPDATE empresas SET saldo = saldo - ${valorDebito} WHERE id = ${empresaLogadaId}`;
                }

                await prisma.$executeRaw`
                    INSERT INTO pedidos (
                        empresa_id, bitrix_deal_id, titulo, nome_cliente, whatsapp_cliente, servico, tipo_arte, tipo_entrega,
                        whatsapp_supervisao, valor_designer, formato, cdr_versao, link_arquivo_impressao, link_arquivo_designer, briefing_completo
                    ) VALUES (
                        ${empresaLogadaId}, ${newDealId}, ${formData.titulo}, ${formData.nomeCliente}, ${formData.wppCliente}, ${formData.servico}, ${arte}, ${tipoEntrega},
                        ${supervisaoWpp || null}, ${valorDesigner ? parseFloat(valorDesigner) : null}, ${formData.formato || null}, ${formData.cdrVersao || null},
                        ${dbLinkImpressao}, ${dbLinkDesigner}, ${briefingFinal}
                    )
                `;

                if (arte === 'Designer Próprio') {
                    await prisma.$executeRaw`
                        INSERT INTO painel_arte_cards (empresa_id, bitrix_deal_id, coluna, posicao)
                        VALUES (${empresaLogadaId}, ${newDealId}, 'NOVOS', 0) ON CONFLICT (bitrix_deal_id) DO NOTHING
                    `;
                }
            } catch (dbError) { console.error(`ERRO DB:`, dbError.message); }
        }

        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error(`ERRO API:`, error.message);
        return res.status(500).json({ message: error.message || 'Erro interno.' });
    }
};
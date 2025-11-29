// /api/createDealForGrafica.js

const prisma = require('../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// --- CONFIGURAÇÃO DE ETAPAS ---
const STAGE_FREELANCER = 'C17:NEW';         
const STAGE_CONFERENCIA = 'C17:UC_ZHMX6W';  
const STAGE_DESIGNER_PROPRIO = 'C17:UC_JHF0WH';

// --- MAPEAMENTO DE CAMPOS ---
const FIELD_BRIEFING_COMPLETO = 'UF_CRM_1738249371';
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';
const FIELD_WHATSAPP_GRAFICA = 'UF_CRM_1760171265'; 
const FIELD_LOGO_ID = 'UF_CRM_1760171060'; 
const FIELD_SERVICO = 'UF_CRM_1761123161542';
const FIELD_ARTE_ORIGEM = 'UF_CRM_1761269158';
const FIELD_TIPO_ENTREGA = 'UF_CRM_1658492661';
const FIELD_ARQUIVO_IMPRESSAO = 'UF_CRM_1748277308731'; 
const FIELD_ARQUIVO_DESIGNER = 'UF_CRM_1740770117580'; 

module.exports = async (req, res) => {
    const reqId = Date.now();
    console.log(`\n[REQ-${reqId}] INICIANDO /api/createDealForGrafica`);

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

        // 1. Identificar Usuário Bitrix
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'NAME', 'COMPANY_ID']
        });

        const user = searchUserResponse.data.result ? searchUserResponse.data.result[0] : null;
        
        if (!user || !user.COMPANY_ID) return res.status(403).json({ message: 'Usuário ou Empresa não identificados.' });

        // 2. Buscar Empresa no Neon (AGORA TRAZENDO O SALDO)
        const empresasLogadas = await prisma.$queryRaw`
            SELECT id, saldo FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1
        `;
        
        if (empresasLogadas.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada no banco de dados.' });
        }

        const empresa = empresasLogadas[0];
        const empresaLogadaId = empresa.id;
        const saldoAtual = parseFloat(empresa.saldo || 0);

        // 3. Preparar Variáveis do Deal
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

        // --- VERIFICAÇÃO E LÓGICA DE SALDO ---

        // A) SETOR DE ARTE (FREELANCER) - EXIGE SALDO
        if (arte === 'Setor de Arte') {
            stageIdSelecionado = STAGE_FREELANCER;
            
            const custoDesigner = parseFloat(valorDesigner || 0);

            // >>> BLOQUEIO POR SALDO INSUFICIENTE <<<
            if (saldoAtual < custoDesigner) {
                console.log(`[REQ-${reqId}] Bloqueio: Saldo Insuficiente. Atual: ${saldoAtual}, Necessário: ${custoDesigner}`);
                return res.status(400).json({ 
                    success: false,
                    message: `Saldo insuficiente para este pedido (R$ ${custoDesigner.toFixed(2)}). <br>Seu saldo atual é R$ ${saldoAtual.toFixed(2)}. <br><a href="/carteira.html" style="color: #fff; text-decoration: underline; font-weight: bold; margin-top: 5px; display: inline-block;">Verificar Carteira →</a>` 
                });
            }

            // Define campos específicos
            const wppLimpo = supervisaoWpp ? supervisaoWpp.replace(/\D/g, '') : '';
            const todosSupervisores = await prisma.$queryRaw`SELECT * FROM empresas`; 
            // Nota: O ideal seria ter uma tabela de supervisores, mas mantendo a lógica atual:
            const supervisor = todosSupervisores.find(e => e.whatsapp && e.whatsapp.replace(/\D/g, '') === wppLimpo);

            if (!supervisor) return res.status(404).json({ message: `Supervisor não encontrado (WPP: ${supervisaoWpp}).` });

            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_LOGO_ID] = supervisor.logo_id || supervisor.logo;
            dealFields[FIELD_SERVICO] = formData.servico;

            // Define o valor para o Bitrix (Ex: 80% do valor cobrado vai para o Opportunity)
            valorOportunidade = (custoDesigner * 0.8).toFixed(2);

            // Adiciona formato ao briefing
            let formatoTexto = formData.formato;
            if (formatoTexto === 'CDR' && formData.cdrVersao) formatoTexto += ` (v${formData.cdrVersao})`;
            briefingFinal += `\n\n--- Formato ---\n${formatoTexto}`;

        // B) ARQUIVO DO CLIENTE
        } else if (arte === 'Arquivo do Cliente') {
            stageIdSelecionado = STAGE_CONFERENCIA;
            if (linkArquivo) {
                dealFields[FIELD_ARQUIVO_IMPRESSAO] = linkArquivo;
                dbLinkImpressao = linkArquivo; 
            }
            valorOportunidade = 0;

        // C) DESIGNER PRÓPRIO
        } else if (arte === 'Designer Próprio') {
            stageIdSelecionado = STAGE_DESIGNER_PROPRIO;
            valorOportunidade = 0;
        
        } else {
            stageIdSelecionado = STAGE_CONFERENCIA;
            valorOportunidade = 0;
        }

        // Aplica campos finais
        dealFields['STAGE_ID'] = stageIdSelecionado;
        dealFields['OPPORTUNITY'] = valorOportunidade;
        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        // ------------------------------------------------------------------
        // 4. CRIAÇÃO NO BITRIX
        // ------------------------------------------------------------------
        console.log(`[REQ-${reqId}] Criando Deal no Bitrix...`);
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, { fields: dealFields });
        
        if (createDealResponse.data.error) throw new Error(createDealResponse.data.error_description);
        const newDealId = createDealResponse.data.result;

        // ------------------------------------------------------------------
        // 5. DESCONTO DO SALDO E REGISTRO NO BANCO LOCAL
        // ------------------------------------------------------------------
        if (newDealId) {
            console.log(`[REQ-${reqId}] Sucesso Bitrix ID: ${newDealId}. Processando banco local...`);
            
            try {
                // Se for Setor de Arte, DEBITA O SALDO da empresa logada
                if (arte === 'Setor de Arte') {
                    const valorDebito = parseFloat(valorDesigner || 0);
                    await prisma.$executeRaw`
                        UPDATE empresas 
                        SET saldo = saldo - ${valorDebito} 
                        WHERE id = ${empresaLogadaId}
                    `;
                    console.log(`[REQ-${reqId}] Saldo debitado: R$ ${valorDebito}`);
                }

                // Insere registro do pedido
                await prisma.$executeRaw`
                    INSERT INTO pedidos (
                        empresa_id, bitrix_deal_id, titulo, nome_cliente, whatsapp_cliente,
                        servico, tipo_arte, tipo_entrega, whatsapp_supervisao,
                        valor_designer, formato, cdr_versao,
                        link_arquivo_impressao, link_arquivo_designer, briefing_completo
                    ) VALUES (
                        ${empresaLogadaId}, ${newDealId}, ${formData.titulo}, ${formData.nomeCliente}, ${formData.wppCliente},
                        ${formData.servico}, ${arte}, ${tipoEntrega}, ${supervisaoWpp || null},
                        ${valorDesigner ? parseFloat(valorDesigner) : null},
                        ${formData.formato || null}, ${formData.cdrVersao || null},
                        ${dbLinkImpressao}, ${dbLinkDesigner}, ${briefingFinal}
                    )
                `;

                // Se for Designer Próprio, insere no Kanban de Arte
                if (arte === 'Designer Próprio') {
                    await prisma.$executeRaw`
                        INSERT INTO painel_arte_cards (empresa_id, bitrix_deal_id, coluna, posicao)
                        VALUES (${empresaLogadaId}, ${newDealId}, 'NOVOS', 0)
                        ON CONFLICT (bitrix_deal_id) DO NOTHING
                    `;
                }

            } catch (dbError) {
                console.error(`[REQ-${reqId}] ERRO CRÍTICO DB (Deal criado no Bitrix mas falha local):`, dbError.message);
                // Nota: Em um sistema ideal, faríamos rollback no Bitrix aqui, 
                // mas para este escopo vamos apenas logar o erro.
            }
        }

        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error(`[REQ-${reqId}] ERRO:`, error.message);
        return res.status(500).json({ message: error.message || 'Erro interno.' });
    }
};
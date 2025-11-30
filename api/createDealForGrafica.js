// /api/createDealForGrafica.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Constantes
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { sessionToken, arte, supervisaoWpp, valorDesigner, tipoEntrega, linkArquivo, ...formData } = req.body;

        if (!sessionToken) return res.status(403).json({ message: 'Sessão inválida.' });

        // 1. Identificar Usuário
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });
        const user = userSearch.data.result ? userSearch.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(403).json({ message: 'Empresa não identificada.' });

        // 2. Validar Saldo
        const empresasLogadas = await prisma.$queryRawUnsafe(
            `SELECT id, COALESCE(saldo, 0) as saldo FROM empresas WHERE bitrix_company_id = $1 LIMIT 1`,
            parseInt(user.COMPANY_ID)
        );
        
        if (empresasLogadas.length === 0) return res.status(404).json({ message: 'Empresa não encontrada no banco.' });

        const empresa = empresasLogadas[0];
        const saldoAtual = parseFloat(empresa.saldo);
        const custoDesigner = parseFloat(valorDesigner || 0);

        if (arte === 'Setor de Arte') {
            if (saldoAtual < custoDesigner) {
                return res.status(400).json({ 
                    success: false,
                    message: `Saldo insuficiente. Necessário: R$ ${custoDesigner.toFixed(2)}. Disponível: R$ ${saldoAtual.toFixed(2)}` 
                });
            }
        }

        // 3. Criar Deal no Bitrix
        let briefingFinal = formData.briefingFormatado || '';
        let stageId = STAGE_CONFERENCIA;
        let valorOportunidade = 0; // Valor padrão

        let dealFields = {
            'TITLE': formData.titulo,
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': user.COMPANY_ID,
            'CATEGORY_ID': 17,
            [FIELD_NOME_CLIENTE]: formData.nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: formData.wppCliente,
            [FIELD_ARTE_ORIGEM]: arte,
            [FIELD_TIPO_ENTREGA]: tipoEntrega
        };

        if (arte === 'Setor de Arte') {
            stageId = STAGE_FREELANCER;
            const wppLimpo = supervisaoWpp ? supervisaoWpp.replace(/\D/g, '') : '';
            const supervisores = await prisma.$queryRawUnsafe(`SELECT * FROM empresas WHERE whatsapp LIKE $1 LIMIT 1`, `%${wppLimpo}%`);
            
            if (supervisores.length > 0) {
                dealFields[FIELD_LOGO_ID] = supervisores[0].logo_id || supervisores[0].logo;
            }
            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_SERVICO] = formData.servico;

            // --- CORREÇÃO DO CÁLCULO E CAMPO DE VALOR ---
            valorOportunidade = parseFloat((custoDesigner * 0.85).toFixed(2));

        } else if (arte === 'Designer Próprio') {
            stageId = STAGE_DESIGNER_PROPRIO;
            valorOportunidade = 0;
        }

        if (linkArquivo) dealFields[FIELD_ARQUIVO_IMPRESSAO] = linkArquivo;
        
        dealFields['STAGE_ID'] = stageId;
        dealFields['OPPORTUNITY'] = valorOportunidade; 
        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal;

        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, { fields: dealFields });
        const newDealId = createDealResponse.data.result;

        // 4. MOVIMENTAÇÃO FINANCEIRA
        if (newDealId && arte === 'Setor de Arte') {
            
            // Atualiza Saldos
            await prisma.$executeRawUnsafe(
                `UPDATE empresas 
                 SET saldo = saldo - $1, 
                     saldo_devedor = COALESCE(saldo_devedor, 0) + $1 
                 WHERE id = $2`,
                custoDesigner,
                empresa.id
            );

            // Grava Histórico
            const tituloHistorico = `Produção: ${formData.titulo} (#${newDealId})`;
            
            await prisma.$executeRawUnsafe(
                `INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data)
                 VALUES ($1, $2, 'SAIDA', $3, $4, NOW())`,
                empresa.id,
                custoDesigner,
                String(newDealId),
                tituloHistorico
            );
        }

        // 5. Salva Pedido (Tabela de Relatório)
        await prisma.$executeRawUnsafe(
            `INSERT INTO pedidos (empresa_id, bitrix_deal_id, titulo, nome_cliente, whatsapp_cliente, servico, tipo_arte, tipo_entrega, valor_designer, briefing_completo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            empresa.id, newDealId, formData.titulo, formData.nomeCliente, formData.wppCliente, formData.servico, arte, tipoEntrega, custoDesigner, briefingFinal
        );

        // 6. ADIÇÃO CRÍTICA: Cria o Card no Painel Kanban (Tabela Visual)
        // Sem isso, o moveCard.js não encontra o registro para mover depois.
        await prisma.$executeRawUnsafe(
            `INSERT INTO painel_arte_cards (empresa_id, bitrix_deal_id, coluna, posicao, updated_at) 
             VALUES ($1, $2, 'NOVOS', 0, NOW())`,
            empresa.id, 
            newDealId
        );

        return res.status(200).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error('Erro criar Deal:', error.message);
        return res.status(500).json({ message: error.message });
    }
};
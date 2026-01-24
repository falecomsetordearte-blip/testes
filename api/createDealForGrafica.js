// /api/createDealForGrafica.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Constantes de Estágios (Funis)
const STAGE_FREELANCER = 'C17:NEW';          // Se for Setor de Arte
const STAGE_CONFERENCIA = 'C17:UC_ZHMX6W';   // Estágio padrão/intermediário
const STAGE_DESIGNER_PROPRIO = 'C17:UC_JHF0WH'; // Se for Designer Próprio

// IDs de Campos Personalizados do Bitrix (Verifique se estão atualizados)
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
    // Configuração CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        // Recebe os dados do Front-end (crm-script.js)
        const { 
            sessionToken, 
            arte, 
            supervisaoWpp, 
            valorDesigner, 
            tipoEntrega, 
            linkArquivo, 
            cdrVersao,     // Vem do formulário
            formato,       // Vem do formulário
            ...formData 
        } = req.body;

        if (!sessionToken) return res.status(403).json({ message: 'Sessão inválida.' });

        // 1. Identificar Usuário e Empresa no Bitrix
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });
        const user = userSearch.data.result ? userSearch.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(403).json({ message: 'Empresa não identificada.' });

        // 2. Validar Saldo no Banco de Dados (Neon)
        const empresasLogadas = await prisma.$queryRawUnsafe(
            `SELECT id, COALESCE(saldo, 0) as saldo FROM empresas WHERE bitrix_company_id = $1 LIMIT 1`,
            parseInt(user.COMPANY_ID)
        );
        
        if (empresasLogadas.length === 0) return res.status(404).json({ message: 'Empresa não encontrada no banco.' });

        const empresa = empresasLogadas[0];
        const saldoAtual = parseFloat(empresa.saldo);
        const custoDesigner = parseFloat(valorDesigner || 0);

        // Se for usar Setor de Arte, verifica se tem dinheiro
        if (arte === 'Setor de Arte') {
            if (saldoAtual < custoDesigner) {
                return res.status(400).json({ 
                    success: false,
                    message: `Saldo insuficiente. Necessário: R$ ${custoDesigner.toFixed(2)}. Disponível: R$ ${saldoAtual.toFixed(2)}` 
                });
            }
        }

        // 3. Preparar Dados para o Bitrix
        
        // MELHORIA: Garante que detalhes técnicos apareçam no texto do briefing
        let briefingFinal = formData.briefingFormatado || '';
        
        // Adiciona rodapé técnico ao briefing para garantir que a produção veja
        briefingFinal += `\n\n=== DETALHES TÉCNICOS ===`;
        if (formato) briefingFinal += `\nFormato: ${formato}`;
        if (cdrVersao) briefingFinal += `\nVersão Corel: ${cdrVersao}`;
        if (tipoEntrega) briefingFinal += `\nEntrega: ${tipoEntrega.toUpperCase()}`;
        // -------------------------------------------------------------

        let stageId = STAGE_CONFERENCIA;
        let valorOportunidade = 0; 

        let dealFields = {
            'TITLE': formData.titulo,
            'CURRENCY_ID': 'BRL',
            'COMPANY_ID': user.COMPANY_ID,
            'CATEGORY_ID': 17, // ID do Pipeline de Arte
            [FIELD_NOME_CLIENTE]: formData.nomeCliente,
            [FIELD_WHATSAPP_CLIENTE]: formData.wppCliente,
            [FIELD_ARTE_ORIGEM]: arte,
            [FIELD_TIPO_ENTREGA]: tipoEntrega // Envia para o campo específico
        };

        // Lógica de Direcionamento (O "Rumo Diferente")
        if (arte === 'Setor de Arte') {
            stageId = STAGE_FREELANCER; // Vai para a coluna de Novos Pedidos dos Designers
            
            // Tenta achar o Logo da Gráfica baseada no Wpp do Supervisor
            const wppLimpo = supervisaoWpp ? supervisaoWpp.replace(/\D/g, '') : '';
            if(wppLimpo) {
                const supervisores = await prisma.$queryRawUnsafe(`SELECT * FROM empresas WHERE whatsapp LIKE $1 LIMIT 1`, `%${wppLimpo}%`);
                if (supervisores.length > 0) {
                    dealFields[FIELD_LOGO_ID] = supervisores[0].logo_id || supervisores[0].logo;
                }
            }
            
            dealFields[FIELD_WHATSAPP_GRAFICA] = supervisaoWpp;
            dealFields[FIELD_SERVICO] = formData.servico;
            
            // Valor que aparece no Card do Bitrix (Custo - 15% taxa sistema, por exemplo)
            valorOportunidade = parseFloat((custoDesigner * 0.85).toFixed(2));

        } else if (arte === 'Designer Próprio') {
            stageId = STAGE_DESIGNER_PROPRIO; // Vai para uma coluna separada ou finalizada
            valorOportunidade = 0;
        }

        if (linkArquivo) dealFields[FIELD_ARQUIVO_IMPRESSAO] = linkArquivo;
        
        dealFields['STAGE_ID'] = stageId;
        dealFields['OPPORTUNITY'] = valorOportunidade; 
        dealFields[FIELD_BRIEFING_COMPLETO] = briefingFinal; // Texto completo com os detalhes

        // Cria o Deal no Bitrix
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, { fields: dealFields });
        
        // Verifica se criou com sucesso
        if(!createDealResponse.data || !createDealResponse.data.result) {
            throw new Error("Erro ao criar card no Bitrix: " + JSON.stringify(createDealResponse.data));
        }

        const newDealId = createDealResponse.data.result;

        // 4. MOVIMENTAÇÃO FINANCEIRA (Apenas se for Setor de Arte)
        if (newDealId && arte === 'Setor de Arte') {
            
            // Desconta do Saldo
            await prisma.$executeRawUnsafe(
                `UPDATE empresas 
                 SET saldo = saldo - $1, 
                     saldo_devedor = COALESCE(saldo_devedor, 0) + $1 
                 WHERE id = $2`,
                custoDesigner,
                empresa.id
            );

            // Grava Histórico de Saída
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

        // 5. Salva na tabela de Relatório de Pedidos
        await prisma.$executeRawUnsafe(
            `INSERT INTO pedidos (empresa_id, bitrix_deal_id, titulo, nome_cliente, whatsapp_cliente, servico, tipo_arte, tipo_entrega, valor_designer, briefing_completo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            empresa.id, newDealId, formData.titulo, formData.nomeCliente, formData.wppCliente, formData.servico, arte, tipoEntrega, custoDesigner, briefingFinal
        );

        // 6. CRIA O CARD NO PAINEL KANBAN DE PRODUÇÃO (painel_arte_cards)
        // Isso faz o pedido aparecer instantaneamente na tela "Meus Pedidos" / Dashboard
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
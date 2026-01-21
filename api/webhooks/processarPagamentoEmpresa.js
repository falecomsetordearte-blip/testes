// api/webhooks/processarPagamentoEmpresa.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 

module.exports = async (req, res) => {
    // 1. Validação do Método
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    try {
        // 2. Captura do ID do Negócio (Bitrix envia document_id[2] = "DEAL_123")
        const dealIdString = req.body['document_id[2]'];
        
        if (!dealIdString) {
            console.log("[WEBHOOK] Ignorado: ID do Deal não encontrado.");
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        console.log(`[WEBHOOK] Iniciando processamento do Deal ID: ${dealId}`);
        
        // 3. Buscar dados completos no Bitrix
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
            console.warn(`[WEBHOOK] Deal ${dealId} não encontrado na API.`);
            return res.status(200).send("OK");
        }

        const bitrixCompanyId = parseInt(deal.COMPANY_ID);
        
        // CÁLCULO FINANCEIRO
        // OPPORTUNITY = Valor que o Designer recebe (Líquido)
        const valorLiquido = parseFloat(deal.OPPORTUNITY || 0); 
        // Reverte a margem de 15% para achar o valor original cobrado do cliente
        const valorBruto = parseFloat((valorLiquido / 0.85).toFixed(2));
        
        const linkAtendimento = deal[CAMPO_LINK_ACOMPANHAR] || '';
        const tituloDeal = deal.TITLE || `Pedido #${dealId}`;

        // 4. Buscar Empresa Local
        const empresas = await prisma.empresa.findMany({
            where: { bitrix_company_id: bitrixCompanyId },
            take: 1
        });

        if (empresas.length > 0) {
            const empresaId = empresas[0].id;

            // 5. TRANSAÇÃO ATÔMICA (Atualiza Saldo + Cria Histórico)
            await prisma.$transaction([
                
                // A. Atualiza Saldos da Empresa
                // Diminui de "Em Produção" (saldo_devedor)
                // Aumenta em "Faturado/Gasto" (aprovados)
                prisma.$executeRawUnsafe(
                    `UPDATE empresas 
                     SET saldo_devedor = GREATEST(0, COALESCE(saldo_devedor, 0) - $1), 
                         aprovados = COALESCE(aprovados, 0) + $2 
                     WHERE id = $3`,
                    valorLiquido, 
                    valorBruto,
                    empresaId
                ),

                // B. Cria registro no Histórico Financeiro usando as novas colunas
                prisma.historicoFinanceiro.create({
                    data: {
                        empresa_id: empresaId,
                        valor: valorBruto,   // Valor positivo
                        titulo: tituloDeal,
                        descricao: `Aprovado: ${tituloDeal}`, // Descrição legível
                        tipo: 'SAIDA',       // Define explicitamente como SAÍDA (Gasto)
                        data: new Date(),
                        // Salva dados técnicos no JSON
                        metadados: JSON.stringify({ 
                            link_atendimento: linkAtendimento, 
                            deal_id: dealId,
                            origem: 'webhook_aprovacao'
                        })
                    }
                })
            ]);

            console.log(`[FINANCEIRO] Sucesso Deal ${dealId}. Saldo atualizado e Histórico gravado.`);
        } else {
            console.warn(`[AVISO] Empresa Bitrix ${bitrixCompanyId} não encontrada no banco local.`);
        }

        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro crítico webhook empresa:", e);
        // Retorna 200 para evitar loop de retentativas do Bitrix em caso de erro lógico
        res.status(200).send("Error processed");
    }
};
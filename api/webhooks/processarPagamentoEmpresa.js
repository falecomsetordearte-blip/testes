// api/webhooks/processarPagamentoEmpresa.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
// Campo personalizado do Bitrix onde fica o link "Ver Atendimento"
const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 

module.exports = async (req, res) => {
    // Responde rápido ao Bitrix para evitar timeout
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    try {
        // Bitrix envia "document_id[2]" no formato "DEAL_12345"
        const dealIdString = req.body['document_id[2]'];
        
        if (!dealIdString) {
            console.log("[WEBHOOK] Ignorado: ID do Deal não encontrado no corpo.");
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        console.log(`[WEBHOOK] Iniciando processamento do Deal ID: ${dealId}`);
        
        // 1. Pegar dados completos do Deal no Bitrix (Valor, Empresa, Link, Título)
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
            console.warn(`[WEBHOOK] Deal ${dealId} não encontrado na API do Bitrix.`);
            return res.status(200).send("OK");
        }

        const bitrixCompanyId = parseInt(deal.COMPANY_ID);
        // Pega o valor "OPPORTUNITY" (Líquido/Custo Designer)
        const valorLiquido = parseFloat(deal.OPPORTUNITY || 0); 
        // Recalcula o Bruto (Valor cobrado do cliente, assumindo margem reversa de 15% -> valor / 0.85)
        const valorBruto = parseFloat((valorLiquido / 0.85).toFixed(2));
        
        const linkAtendimento = deal[CAMPO_LINK_ACOMPANHAR] || '';
        const tituloDeal = deal.TITLE || `Pedido #${dealId}`;

        // 2. Buscar ID Local da Empresa
        const empresas = await prisma.empresa.findMany({
            where: { bitrix_company_id: bitrixCompanyId },
            take: 1
        });

        if (empresas.length > 0) {
            const empresaId = empresas[0].id;

            // 3. TRANSAÇÃO ATÔMICA
            // Garante que o saldo só atualiza se o histórico for criado e vice-versa.
            await prisma.$transaction([
                
                // A. Atualiza Saldos da Empresa
                // Diminui de "saldo_devedor" (Em Produção)
                // Aumenta em "aprovados" (Total Faturado/Gasto)
                prisma.$executeRawUnsafe(
                    `UPDATE empresas 
                     SET saldo_devedor = GREATEST(0, COALESCE(saldo_devedor, 0) - $1), 
                         aprovados = COALESCE(aprovados, 0) + $2 
                     WHERE id = $3`,
                    valorLiquido, 
                    valorBruto,
                    empresaId
                ),

                // B. Cria registro no Histórico Financeiro
                // 'metadados' armazena o JSON com o link para recuperação posterior
                prisma.historicoFinanceiro.create({
                    data: {
                        empresa_id: empresaId,
                        valor: valorBruto, // Registra o valor cheio que o cliente pagou/gastou
                        tipo: 'SAIDA',     // Saída do saldo (gasto)
                        titulo: tituloDeal,
                        descricao: `Aprovado: ${tituloDeal}`,
                        data: new Date(),
                        // Armazena link e ID extra num campo JSON ou Texto
                        // Certifique-se que seu schema.prisma tem o campo 'metadados' (String ou Json) na tabela HistoricoFinanceiro
                        // Se não tiver, você pode concatenar no campo descrição, mas o ideal é ter metadados.
                        metadados: JSON.stringify({ 
                            link_atendimento: linkAtendimento, 
                            deal_id: dealId,
                            origem: 'webhook_aprovacao'
                        })
                    }
                })
            ]);

            console.log(`[FINANCEIRO] Deal ${dealId} processado com sucesso. Devedor -${valorLiquido}, Aprovados +${valorBruto}, Histórico criado.`);
        } else {
            console.warn(`[AVISO] Empresa Bitrix ${bitrixCompanyId} não encontrada no banco local.`);
        }

        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro crítico webhook empresa:", e);
        // Retornamos 200 para o Bitrix não ficar tentando reenviar em caso de erro de lógica interna
        res.status(200).send("Error processed");
    }
};
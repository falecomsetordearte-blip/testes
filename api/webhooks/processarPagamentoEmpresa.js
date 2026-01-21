// api/webhooks/processarPagamentoEmpresa.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    try {
        const dealIdString = req.body['document_id[2]'];
        if (!dealIdString) return res.status(200).send("OK");

        const dealId = dealIdString.replace('DEAL_', '');
        console.log(`[WEBHOOK] Processando Deal ID: ${dealId}`);
        
        // 1. Dados do Bitrix
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) return res.status(200).send("OK");

        const bitrixCompanyId = parseInt(deal.COMPANY_ID);
        const valorLiquido = parseFloat(deal.OPPORTUNITY || 0); 
        const valorBruto = parseFloat((valorLiquido / 0.85).toFixed(2));
        
        const linkAtendimento = deal[CAMPO_LINK_ACOMPANHAR] || '';
        const tituloDeal = deal.TITLE || `Pedido #${dealId}`;

        // 2. Empresa Local
        const empresas = await prisma.empresa.findMany({
            where: { bitrix_company_id: bitrixCompanyId },
            take: 1
        });

        if (empresas.length > 0) {
            const empresaId = empresas[0].id;

            // 3. Transação no Banco
            await prisma.$transaction([
                // A. Atualiza Saldos
                prisma.$executeRawUnsafe(
                    `UPDATE empresas 
                     SET saldo_devedor = GREATEST(0, COALESCE(saldo_devedor, 0) - $1), 
                         aprovados = COALESCE(aprovados, 0) + $2 
                     WHERE id = $3`,
                    valorLiquido, 
                    valorBruto,
                    empresaId
                ),

                // B. Cria Histórico (AGORA FUNCIONA POIS CRIAMOS AS COLUNAS)
                prisma.historicoFinanceiro.create({
                    data: {
                        empresa_id: empresaId,
                        valor: valorBruto,   // Valor positivo, pois temos o campo 'tipo'
                        titulo: tituloDeal,
                        descricao: `Aprovado: ${tituloDeal}`,
                        tipo: 'SAIDA',       // Indica que é um gasto/faturamento
                        data: new Date(),
                        // Salvamos o link e ID num JSON string dentro de metadados
                        metadados: JSON.stringify({ 
                            link_atendimento: linkAtendimento, 
                            deal_id: dealId,
                            origem: 'webhook'
                        })
                    }
                })
            ]);

            console.log(`[FINANCEIRO] Sucesso Deal ${dealId}.`);
        } else {
            console.warn(`[AVISO] Empresa Bitrix ${bitrixCompanyId} não encontrada.`);
        }

        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro crítico webhook:", e);
        res.status(200).send("Error processed");
    }
};
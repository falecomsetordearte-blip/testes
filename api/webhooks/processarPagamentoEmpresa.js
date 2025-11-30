// /api/webhooks/processarPagamentoEmpresa.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    try {
        const dealIdString = req.body['document_id[2]'];
        if (!dealIdString) return res.status(200).send("OK");

        const dealId = dealIdString.replace('DEAL_', '');
        
        // 1. Pegar dados do Deal (Valor e Empresa)
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) return res.status(200).send("OK");

        const bitrixCompanyId = parseInt(deal.COMPANY_ID);
        
        // O valor que vem do Bitrix (OPPORTUNITY) é o valor Líquido (o que vai para o designer)
        // Exemplo: 85.00
        const valorBase = parseFloat(deal.OPPORTUNITY || 0); 
        
        // CÁLCULO CORRIGIDO:
        // Para reverter o desconto de 15% e achar o Valor Bruto Original (pago pela Gráfica),
        // dividimos o valor líquido por 0.85.
        // Exemplo: 85.00 / 0.85 = 100.00
        const valorComAcrescimo = parseFloat((valorBase / 0.85).toFixed(2));

        // 2. Buscar ID Local da Empresa
        const empresas = await prisma.$queryRawUnsafe(
            `SELECT id FROM empresas WHERE bitrix_company_id = $1 LIMIT 1`,
            bitrixCompanyId
        );

        if (empresas.length > 0) {
            const empresaId = empresas[0].id;

            // 3. ATUALIZAÇÃO FINANCEIRA (SQL PURO)
            // Tira de 'saldo_devedor' o valor líquido (Ex: 85.00 - Custo do Designer)
            // Adiciona em 'aprovados' o valor bruto (Ex: 100.00 - O que o cliente pagou originalmente)
            await prisma.$executeRawUnsafe(
                `UPDATE empresas 
                 SET saldo_devedor = GREATEST(0, COALESCE(saldo_devedor, 0) - $1), 
                     aprovados = COALESCE(aprovados, 0) + $2 
                 WHERE id = $3`,
                valorBase, 
                valorComAcrescimo,
                empresaId
            );

            console.log(`[FINANCEIRO] Deal ${dealId} processado. Devedor -${valorBase}, Aprovados +${valorComAcrescimo}`);
        } else {
            console.warn(`[AVISO] Empresa Bitrix ${bitrixCompanyId} não encontrada no banco local.`);
        }

        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro webhook empresa:", e.message);
        res.status(200).send("OK");
    }
};
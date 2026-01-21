// api/webhooks/processarPagamentoEmpresa.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
// Campo personalizado do Bitrix onde fica o link "Ver Atendimento"
const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 

module.exports = async (req, res) => {
    // Responde rápido ao Bitrix
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    try {
        const dealIdString = req.body['document_id[2]'];
        
        if (!dealIdString) {
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        console.log(`[WEBHOOK] Iniciando processamento do Deal ID: ${dealId}`);
        
        // 1. Pegar dados completos do Deal
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
            console.warn(`[WEBHOOK] Deal ${dealId} não encontrado.`);
            return res.status(200).send("OK");
        }

        const bitrixCompanyId = parseInt(deal.COMPANY_ID);
        // Valor Líquido (Custo Designer)
        const valorLiquido = parseFloat(deal.OPPORTUNITY || 0); 
        // Valor Bruto (Cliente)
        const valorBruto = parseFloat((valorLiquido / 0.85).toFixed(2));
        
        const linkAtendimento = deal[CAMPO_LINK_ACOMPANHAR] || '';
        const tituloDeal = deal.TITLE || `Pedido #${dealId}`;

        // Truque para salvar o link sem criar coluna nova no banco:
        // Se tiver link, salvamos: "Titulo do Pedido ||| https://link..."
        const descricaoComLink = linkAtendimento 
            ? `${tituloDeal} ||| ${linkAtendimento}` 
            : `Aprovado: ${tituloDeal}`;

        // 2. Buscar Empresa Local
        const empresas = await prisma.empresa.findMany({
            where: { bitrix_company_id: bitrixCompanyId },
            take: 1
        });

        if (empresas.length > 0) {
            const empresaId = empresas[0].id;

            // 3. TRANSAÇÃO
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

                // B. Cria Histórico (CORRIGIDO: Sem campos 'tipo' ou 'metadados')
                prisma.historicoFinanceiro.create({
                    data: {
                        empresa_id: empresaId,
                        valor: -valorBruto, // <--- VALOR NEGATIVO indica SAÍDA/GASTO
                        titulo: tituloDeal,
                        descricao: descricaoComLink, // Link escondido aqui
                        data: new Date()
                    }
                })
            ]);

            console.log(`[FINANCEIRO] Sucesso Deal ${dealId}. Saldo atualizado.`);
        } else {
            console.warn(`[AVISO] Empresa Bitrix ${bitrixCompanyId} não encontrada.`);
        }

        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro crítico webhook:", e);
        res.status(200).send("Error processed");
    }
};
// /api/webhooks/processarPagamentoEmpresa.js

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

async function atualizarSaldosEmpresa(companyId, valorPagamento, dealId, dealTitle) {
    if (!companyId || !valorPagamento || !valorPagamento.gt(0)) {
        console.warn(`[AVISO] Dados inválidos para empresa ${companyId}.`);
        return;
    }

    try {
        // 1. Buscar dados da empresa no Bitrix24
        const companyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId });
        const companyData = companyResponse.data.result;

        if (!companyData) {
            console.error(`[ERRO] Empresa Bitrix ${companyId} não encontrada.`);
            return;
        }

        // 2. Tenta pegar WhatsApp do campo customizado OU do campo padrão PHONE
        let whatsappBitrix = companyData['UF_CRM_1760171265'];
        if (!whatsappBitrix && companyData.PHONE && companyData.PHONE.length > 0) {
            whatsappBitrix = companyData.PHONE[0].VALUE;
        }

        if (!whatsappBitrix) {
            console.error(`[ERRO] Empresa Bitrix ${companyId} sem telefone cadastrado.`);
            return;
        }

        const whatsappNumerico = whatsappBitrix.replace(/\D/g, '');

        // 3. Buscar a empresa no banco local
        const empresaLocal = await prisma.empresa.findFirst({
            where: { whatsapp: whatsappNumerico }
        });

        if (!empresaLocal) {
            console.warn(`[AVISO] Empresa com WPP ${whatsappNumerico} não encontrada no Neon.`);
            return;
        }

        // 4. ATUALIZAR SALDOS E CRIAR HISTÓRICO (TRANSACTION)
        // Isso atualiza o saldo e cria o registro na tabela historico_financeiro ao mesmo tempo
        await prisma.$transaction([
            prisma.empresa.update({
                where: { id: empresaLocal.id },
                data: {
                    saldo_devedor: { decrement: valorPagamento }, // Em Andamento diminui
                    aprovados: { increment: valorPagamento },     // À Pagar aumenta
                },
            }),
            prisma.historicoFinanceiro.create({
                data: {
                    empresa_id: empresaLocal.id,
                    valor: valorPagamento,
                    deal_id: String(dealId),
                    titulo: dealTitle || `Pedido ID ${dealId}`,
                    data: new Date()
                }
            })
        ]);

        console.log(`[SUCESSO] Financeiro atualizado para empresa ID ${empresaLocal.id}. Pedido: ${dealTitle}`);

    } catch (error) {
        console.error(`[ERRO CRÍTICO] Falha ao processar empresa Bitrix ID ${companyId}:`, error.message);
    }
}

module.exports = async (req, res) => {
    try {
        const dealIdString = req.body['document_id[2]'];
        if (!dealIdString) {
            // Se não vier ID, apenas retorna OK para o Bitrix não ficar tentando de novo
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        
        // Pega dados do Deal (ID, Valor, Título)
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) return res.status(200).send("OK");

        const companyId = parseInt(deal.COMPANY_ID, 10);
        const valorPagamento = new Decimal(deal.OPPORTUNITY || 0);
        const dealTitle = deal.TITLE;

        await atualizarSaldosEmpresa(companyId, valorPagamento, dealId, dealTitle);

        res.status(200).send("OK");
    } catch(e) {
        console.error("Erro webhook:", e.message);
        res.status(200).send("OK");
    }
};
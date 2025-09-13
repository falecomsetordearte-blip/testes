// /api/impressao/approveFile.js
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const FIELD_STATUS_PAGAMENTO_DESIGNER = 'UF_CRM_1757789502613';
const STATUS_PAGO_ID = '2675';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId } = req.body;
        if (!dealId) {
            return res.status(400).json({ message: 'ID do Negócio é obrigatório.' });
        }

        console.log(`[approveFile] Iniciando processo de aprovação para o Deal ID: ${dealId}`);

        // --- AÇÃO 1: Atualizar o campo de status de pagamento no Bitrix24 ---
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: {
                [FIELD_STATUS_PAGAMENTO_DESIGNER]: STATUS_PAGO_ID
            }
        });
        console.log(`[approveFile] Deal ${dealId} atualizado com status de pagamento PAGO.`);

        // --- AÇÃO 2: Processar o pagamento do designer (lógica extraída do webhook) ---
        
        // 2a. Buscar os dados do negócio para saber o responsável e o valor
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;
        
        if (!deal) {
            throw new Error(`Negócio com ID ${dealId} não encontrado no Bitrix24.`);
        }
        
        const designerId = parseInt(deal.ASSIGNED_BY_ID, 10);
        const comissao = new Decimal(deal.OPPORTUNITY || 0);
        
        // 2b. Executar a lógica de pagamento se houver designer e valor
        if (designerId && comissao.gt(0)) {
            await prisma.designerFinanceiro.upsert({
                where: { designer_id: designerId },
                update: {
                    saldo_disponivel: {
                        increment: comissao,
                    },
                },
                create: {
                    designer_id: designerId,
                    saldo_disponivel: comissao,
                },
            });
            console.log(`[approveFile] SUCESSO: Saldo do designer ID ${designerId} incrementado em ${comissao}.`);
        } else {
            console.warn(`[approveFile] AVISO: Pagamento para Deal ${dealId} não processado. Designer ID: ${designerId}, Comissão: ${comissao}.`);
        }

        return res.status(200).json({ message: 'Arquivo aprovado e pagamento processado com sucesso!' });

    } catch (error) {
        console.error("[approveFile] Erro no processo de aprovação e pagamento:", error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao aprovar o arquivo. Verifique os logs.' });
    }
};
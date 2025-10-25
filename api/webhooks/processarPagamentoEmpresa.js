// /api/webhooks/processarPagamentoEmpresa.js - VERSÃO FINAL (COM FALLBACK PARA O CAMPO PHONE)

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

/**
 * Atualiza os saldos de uma empresa no banco de dados.
 * Subtrai o valor do pagamento do 'saldo_devedor' e adiciona ao 'aprovados'.
 * @param {number} companyId - O ID da empresa no Bitrix24.
 * @param {Decimal} valorPagamento - O valor do pagamento (OPPORTUNITY do deal).
 */
async function atualizarSaldosEmpresa(companyId, valorPagamento) {
    if (!companyId || !valorPagamento || !valorPagamento.gt(0)) {
        console.warn(`[AVISO] ID da empresa no Bitrix (${companyId}) ou valor do pagamento (${valorPagamento}) são inválidos.`);
        return;
    }

    try {
        // 1. Buscar dados da empresa no Bitrix24
        const companyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId });
        const companyData = companyResponse.data.result;

        if (!companyData) {
            console.error(`[ERRO] Empresa com ID Bitrix ${companyId} não encontrada no Bitrix24.`);
            return;
        }

        // --- LÓGICA DE FALLBACK APLICADA AQUI ---
        // 2. Tenta obter o WhatsApp do campo customizado primeiro.
        let whatsappBitrix = companyData['UF_CRM_1760171265'];

        // Se o campo customizado estiver vazio/nulo/undefined, usa o campo padrão 'PHONE' como alternativa.
        if (!whatsappBitrix && companyData.PHONE && companyData.PHONE.length > 0) {
            console.log(`[INFO] Campo customizado 'UF_CRM_1760171265' não encontrado ou vazio. Usando o campo 'PHONE' principal como alternativa.`);
            whatsappBitrix = companyData.PHONE[0].VALUE;
        }
        // --- FIM DA LÓGICA DE FALLBACK ---

        if (!whatsappBitrix) {
            console.error(`[ERRO] Não foi possível encontrar um número de WhatsApp/Telefone para a empresa com ID Bitrix ${companyId}. Nenhum campo (customizado ou padrão) está preenchido.`);
            // Opcional: Logar o objeto da empresa para depuração futura, caso este erro ocorra.
            // console.log('[DEBUG] Objeto da empresa sem telefone:', JSON.stringify(companyData, null, 2));
            return;
        }

        // 3. Limpar o número para conter apenas dígitos
        const whatsappNumerico = whatsappBitrix.replace(/\D/g, '');

        // 4. Atualizar os saldos na tabela 'empresas'
        const updatedEmpresa = await prisma.empresa.updateMany({
            where: {
                whatsapp: whatsappNumerico
            },
            data: {
                saldo_devedor: {
                    decrement: valorPagamento,
                },
                aprovados: {
                    increment: valorPagamento,
                },
            },
        });

        // 5. Logar o resultado da operação
        if (updatedEmpresa.count > 0) {
            console.log(`[SUCESSO] Saldos de ${updatedEmpresa.count} empresa(s) com WhatsApp ${whatsappNumerico} atualizados: Saldo Devedor -${valorPagamento}, Aprovados +${valorPagamento}.`);
        } else {
            console.warn(`[AVISO] Nenhuma empresa foi encontrada no nosso banco de dados com o WhatsApp: ${whatsappNumerico}. A empresa pode não estar cadastrada.`);
        }

    } catch (error) {
        console.error(`[ERRO CRÍTICO] Falha ao processar atualização de saldo para empresa Bitrix ID ${companyId}:`, error.message);
    }
}


// Handler principal do Webhook
module.exports = async (req, res) => {
    try {
        const dealIdString = req.body['document_id[2]'];

        if (!dealIdString) {
            console.warn("[AVISO] Webhook recebido sem 'document_id[2]'. Ignorando.");
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
             console.error(`[ERRO] Negócio com ID ${dealId} não encontrado no Bitrix24.`);
             return res.status(200).send("OK");
        }

        const companyId = parseInt(deal.COMPANY_ID, 10);
        const valorPagamento = new Decimal(deal.OPPORTUNITY || 0);

        await atualizarSaldosEmpresa(companyId, valorPagamento);

        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro geral no webhook de pagamento da empresa:", e.response ? e.response.data : e.message);
        res.status(200).send("OK");
    }
};
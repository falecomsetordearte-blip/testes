// /api/webhooks/processarPagamentoEmpresa.js - VERSÃO PARA EMPRESA

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
    // Validação inicial dos dados recebidos
    if (!companyId || !valorPagamento || !valorPagamento.gt(0)) {
        console.warn(`[AVISO] ID da empresa no Bitrix (${companyId}) ou valor do pagamento (${valorPagamento}) são inválidos.`);
        return;
    }

    try {
        // 1. Buscar dados da empresa no Bitrix24 para obter o WhatsApp
        const companyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId });
        const companyData = companyResponse.data.result;

        if (!companyData) {
            console.error(`[ERRO] Empresa com ID Bitrix ${companyId} não encontrada no Bitrix24.`);
            return;
        }

        // 2. Extrair o número de WhatsApp do campo customizado UF_CRM_1760171265
        const whatsappBitrix = companyData['UF_CRM_1760171265'];

        if (!whatsappBitrix) {
            console.error(`[ERRO] Não foi possível encontrar o WhatsApp (campo UF_CRM_1760171265) para a empresa com ID Bitrix ${companyId}.`);
            return;
        }

        // 3. Limpar o número para conter apenas dígitos, garantindo a correspondência no banco de dados
        const whatsappNumerico = whatsappBitrix.replace(/\D/g, '');

        // 4. Atualizar os saldos na tabela 'empresas' usando o WhatsApp como chave de busca
        const updatedEmpresa = await prisma.empresa.updateMany({
            where: {
                whatsapp: whatsappNumerico
            },
            data: {
                saldo_devedor: {
                    decrement: valorPagamento, // Subtrai o valor do saldo devedor
                },
                aprovados: {
                    increment: valorPagamento, // Adiciona o valor aos aprovados
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
        // Captura erros específicos da busca no Bitrix ou da atualização no Prisma
        console.error(`[ERRO CRÍTICO] Falha ao processar atualização de saldo para empresa Bitrix ID ${companyId}:`, error.message);
    }
}


// Handler principal do Webhook
module.exports = async (req, res) => {
    try {
        // Pega o ID do "documento", que no contexto do Bitrix24 é o Deal (Negócio)
        const dealIdString = req.body['document_id[2]'];

        if (!dealIdString) {
            console.warn("[AVISO] Webhook recebido sem 'document_id[2]'. Ignorando.");
            return res.status(200).send("OK"); // Responde OK para o Bitrix não reenviar
        }

        // Extrai o número do ID do negócio (ex: "DEAL_123" -> "123")
        const dealId = dealIdString.replace('DEAL_', '');

        // Busca os detalhes completos do negócio no Bitrix24
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
             console.error(`[ERRO] Negócio com ID ${dealId} não encontrado no Bitrix24.`);
             return res.status(200).send("OK");
        }

        // Extrai as informações necessárias do negócio
        const companyId = parseInt(deal.COMPANY_ID, 10);
        const valorPagamento = new Decimal(deal.OPPORTUNITY || 0);

        // Chama a função principal que executa a lógica de atualização
        await atualizarSaldosEmpresa(companyId, valorPagamento);

        // Envia resposta de sucesso para o Bitrix24
        res.status(200).send("OK");

    } catch(e) {
        // Tratamento genérico de erros para garantir que o webhook sempre responda
        console.error("Erro geral no webhook de pagamento da empresa:", e.response ? e.response.data : e.message);
        // É crucial responder 200 OK mesmo em caso de erro para evitar que o Bitrix24
        // tente reenviar o webhook indefinidamente. Os logs são nossa ferramenta de depuração.
        res.status(200).send("OK");
    }
};
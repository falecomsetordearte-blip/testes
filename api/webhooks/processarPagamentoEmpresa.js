// /api/webhooks/processarPagamentoEmpresa.js - VERSÃO COM LOGS DE DEPURAÇÃO

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
    console.log(`[DEBUG] Iniciando a função atualizarSaldosEmpresa para Company ID: ${companyId} e Valor: ${valorPagamento.toString()}`);

    // Validação inicial dos dados recebidos
    if (!companyId || !valorPagamento || !valorPagamento.gt(0)) {
        console.warn(`[AVISO] ID da empresa no Bitrix (${companyId}) ou valor do pagamento (${valorPagamento}) são inválidos. Função abortada.`);
        return;
    }

    try {
        // 1. Buscar dados da empresa no Bitrix24 para obter o WhatsApp
        console.log(`[DEBUG] Passo 1: Buscando dados da empresa com ID ${companyId} no Bitrix24...`);
        const companyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId });
        
        // --- LOG CRÍTICO ---
        // Este log é o mais importante. Ele mostrará a resposta completa da API do Bitrix.
        console.log(`[DEBUG] Resposta completa da API do Bitrix para crm.company.get: \n${JSON.stringify(companyResponse.data, null, 2)}`);

        const companyData = companyResponse.data.result;

        if (!companyData) {
            console.error(`[ERRO] A resposta da API do Bitrix não contém a propriedade 'result'. A empresa com ID Bitrix ${companyId} pode não existir ou a API retornou um erro.`);
            return;
        }

        console.log(`[DEBUG] Passo 2: Dados da empresa obtidos com sucesso. Tentando extrair o campo de WhatsApp 'UF_CRM_1760171265'.`);

        // 2. Extrair o número de WhatsApp do campo customizado UF_CRM_1760171265
        const whatsappBitrix = companyData['UF_CRM_1760171265'];
        
        console.log(`[DEBUG] Valor encontrado para o campo 'UF_CRM_1760171265':`, whatsappBitrix); // Loga o valor encontrado (ou 'undefined')

        if (!whatsappBitrix) {
            console.error(`[ERRO] Não foi possível encontrar o WhatsApp (campo UF_CRM_1760171265) para a empresa com ID Bitrix ${companyId}. Verifique se o campo está preenchido no Bitrix para esta empresa.`);
            return;
        }

        console.log(`[DEBUG] Passo 3: WhatsApp encontrado no Bitrix: "${whatsappBitrix}". Limpando para conter apenas números.`);
        
        // 3. Limpar o número para conter apenas dígitos
        const whatsappNumerico = whatsappBitrix.replace(/\D/g, '');
        console.log(`[DEBUG] WhatsApp numérico após limpeza: "${whatsappNumerico}"`);


        // 4. Atualizar os saldos na tabela 'empresas'
        console.log(`[DEBUG] Passo 4: Executando atualização no banco de dados para a empresa com WhatsApp ${whatsappNumerico}...`);
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
        console.log(`[DEBUG] Passo 5: Operação no banco de dados concluída.`);
        if (updatedEmpresa.count > 0) {
            console.log(`[SUCESSO] Saldos de ${updatedEmpresa.count} empresa(s) com WhatsApp ${whatsappNumerico} atualizados: Saldo Devedor -${valorPagamento}, Aprovados +${valorPagamento}.`);
        } else {
            console.warn(`[AVISO] Nenhuma empresa foi encontrada no nosso banco de dados com o WhatsApp: ${whatsappNumerico}. A empresa pode não estar cadastrada no nosso sistema ou o número está diferente.`);
        }

    } catch (error) {
        console.error(`[ERRO CRÍTICO] Falha ao processar atualização de saldo para empresa Bitrix ID ${companyId}:`, error.message);
        if (error.response) {
            console.error('[ERRO CRÍTICO] Detalhes da resposta do Axios:', error.response.data);
        }
    }
}


// Handler principal do Webhook
module.exports = async (req, res) => {
    try {
        console.log('[INFO] Webhook de pagamento da empresa recebido.');
        const dealIdString = req.body['document_id[2]'];

        if (!dealIdString) {
            console.warn("[AVISO] Webhook recebido sem 'document_id[2]'. Ignorando.");
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        console.log(`[INFO] Processando Negócio (Deal) ID: ${dealId}`);
        
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
             console.error(`[ERRO] Negócio com ID ${dealId} não encontrado no Bitrix24.`);
             return res.status(200).send("OK");
        }
        
        const companyId = parseInt(deal.COMPANY_ID, 10);
        const valorPagamento = new Decimal(deal.OPPORTUNITY || 0);

        await atualizarSaldosEmpresa(companyId, valorPagamento);

        console.log(`[INFO] Processamento do Negócio ID ${dealId} finalizado.`);
        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro geral no webhook de pagamento da empresa:", e.response ? e.response.data : e.message);
        res.status(200).send("OK");
    }
};
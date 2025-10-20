// /api/webhooks/processarPagamentoDesigner.js - VERSÃO FINAL CORRIGIDA (USA WHATSAPP)

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Função para atualizar o saldo do designer (sem alterações)
async function atualizarSaldoDesigner(designerId, comissao) {
    if (!designerId || !comissao.gt(0)) {
        console.warn(`[AVISO DESIGNER] ID do designer (${designerId}) ou comissão (${comissao}) inválidos.`);
        return;
    }
    await prisma.designerFinanceiro.upsert({
        where: { designer_id: designerId },
        update: {
            saldo_disponivel: { increment: comissao },
        },
        create: {
            designer_id: designerId,
            saldo_disponivel: comissao,
        },
    });
    console.log(`[SUCESSO DESIGNER] Saldo do designer ID ${designerId} incrementado em ${comissao}.`);
}

// Função para atualizar o saldo da empresa (agora usando WhatsApp)
async function atualizarSaldoEmpresa(companyId, comissao) {
    const valorAprovado = comissao.times('1.15');

    if (!companyId || !valorAprovado.gt(0)) {
        console.warn(`[AVISO EMPRESA] ID da empresa no Bitrix (${companyId}) ou valor (${valorAprovado}) inválidos.`);
        return;
    }
    
    // 1. Buscar dados da empresa no Bitrix24 para obter o WhatsApp
    const companyResponse = await axios.post(`${BITRIX24_API_URL}crm.company.get.json`, { id: companyId });
    const companyData = companyResponse.data.result;

    // --- CORREÇÃO APLICADA AQUI ---
    // Usamos o campo de WhatsApp que você informou: UF_CRM_1760171265
    const whatsappBitrix = companyData['UF_CRM_1760171265']; 

    if (!whatsappBitrix) {
        console.error(`[ERRO EMPRESA] Não foi possível encontrar o WhatsApp para a empresa com ID Bitrix ${companyId}.`);
        return;
    }
    
    // Limpamos o número para conter apenas dígitos, garantindo a correspondência
    const whatsappNumerico = whatsappBitrix.replace(/\D/g, '');

    // 2. Atualizar a empresa no nosso banco de dados usando o WhatsApp
    const updatedEmpresa = await prisma.empresa.updateMany({ // Usamos updateMany para segurança, caso haja duplicados
        where: { whatsapp: whatsappNumerico },
        data: {
            aprovados: {
                increment: valorAprovado,
            },
        },
    });

    if (updatedEmpresa.count > 0) {
        console.log(`[SUCESSO EMPRESA] Saldo 'aprovados' de ${updatedEmpresa.count} empresa(s) com WhatsApp ${whatsappNumerico} incrementado em ${valorAprovado}.`);
    } else {
        console.warn(`[AVISO EMPRESA] Nenhuma empresa encontrada no banco de dados com o WhatsApp: ${whatsappNumerico}`);
    }
}


module.exports = async (req, res) => {
    try {
        const dealIdString = req.body['document_id[2]']; 
        
        if (!dealIdString) {
            console.warn("[AVISO] Webhook recebido sem 'document_id[2]'.");
            return res.status(200).send("OK");
        }

        const dealId = dealIdString.replace('DEAL_', '');
        
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealResponse.data.result;

        const designerId = parseInt(deal.ASSIGNED_BY_ID, 10);
        const companyId = parseInt(deal.COMPANY_ID, 10);
        const comissao = new Decimal(deal.OPPORTUNITY || 0);
        
        await atualizarSaldoDesigner(designerId, comissao);
        await atualizarSaldoEmpresa(companyId, comissao);
        
        res.status(200).send("OK");

    } catch(e) {
        console.error("Erro no webhook de pagamento:", e.response ? e.response.data : e.message);
        res.status(200).send("OK");
    }
};
// api/carteira/solicitarCredito.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const nodemailer = require('nodemailer'); // Instale: npm install nodemailer

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
// Configuração de email (Adicione no .env se for usar)
const EMAIL_USER = process.env.EMAIL_USER; // falarsetordearte@gmail.com
const EMAIL_PASS = process.env.EMAIL_PASS; // Senha de App do Gmail

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { sessionToken, formData } = req.body;

    try {
        // 1. Auth Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID', 'NAME', 'LAST_NAME']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const contact = userCheck.data.result[0];
        const bitrixCompanyId = contact.COMPANY_ID;
        const nomeUsuario = `${contact.NAME} ${contact.LAST_NAME}`;

        // 2. Atualizar Banco de Dados (Status Pendente)
        await prisma.empresa.updateMany({
            where: { bitrix_company_id: parseInt(bitrixCompanyId) },
            data: {
                solicitacao_credito_pendente: true,
                dados_analise_credito: formData // Salva o JSON com os dados
            }
        });

        // 3. Enviar Email (Opcional - Falha silenciosa se não configurado)
        if (EMAIL_USER && EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: EMAIL_USER, pass: EMAIL_PASS }
            });

            const htmlContent = `
                <h3>Nova Solicitação de Análise de Crédito</h3>
                <p><strong>Cliente:</strong> ${nomeUsuario} (Bitrix ID: ${bitrixCompanyId})</p>
                <hr/>
                <p><strong>Razão Social:</strong> ${formData.razaoSocial}</p>
                <p><strong>CNPJ:</strong> ${formData.cnpj}</p>
                <p><strong>Faturamento Mensal:</strong> ${formData.faturamento}</p>
                <p><strong>Tempo de Atividade:</strong> ${formData.tempoAtividade}</p>
                <p><strong>Contador:</strong> ${formData.contador}</p>
                <p><strong>Observações:</strong> ${formData.obs}</p>
            `;

            await transporter.sendMail({
                from: EMAIL_USER,
                to: 'falarsetordearte@gmail.com',
                subject: `Solicitação de Crédito - ${formData.razaoSocial}`,
                html: htmlContent
            });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro solicitarCredito:", error);
        res.status(500).json({ message: 'Erro ao processar solicitação.' });
    }
};
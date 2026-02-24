// api/carteira/solicitarCredito.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer'); 

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { sessionToken, formData } = req.body;

    try {
        // 1. AUTENTICAÇÃO NEON
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }
        
        const empresa = empresas[0];
        const nomeUsuario = empresa.nome_fantasia || "Cliente Neon";

        // 2. Atualizar Banco de Dados (Status Pendente)
        await prisma.empresa.update({
            where: { id: empresa.id },
            data: {
                solicitacao_credito_pendente: true,
                // Opcional: Se quiser salvar o JSON em uma coluna, crie 'dados_analise_credito' no prisma schema
                // Se não tiver a coluna, comente a linha abaixo:
                // dados_analise_credito: JSON.stringify(formData) 
            }
        });

        // 3. Enviar Email
        if (EMAIL_USER && EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: EMAIL_USER, pass: EMAIL_PASS }
            });

            const htmlContent = `
                <h3>Nova Solicitação de Análise de Crédito</h3>
                <p><strong>Cliente:</strong> ${nomeUsuario} (ID Neon: ${empresa.id})</p>
                <hr/>
                <p><strong>Razão Social:</strong> ${formData.razaoSocial}</p>
                <p><strong>CNPJ:</strong> ${formData.cnpj}</p>
                <p><strong>Faturamento:</strong> ${formData.faturamento}</p>
                <p><strong>Tempo Atividade:</strong> ${formData.tempoAtividade}</p>
                <p><strong>Contador:</strong> ${formData.contador}</p>
                <p><strong>Obs:</strong> ${formData.obs}</p>
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
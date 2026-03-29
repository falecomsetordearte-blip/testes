// api/carteira/informarPagamento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { put } = require('@vercel/blob');
const { IncomingForm } = require('formidable');
const fs = require('fs');

export const config = {
    api: { bodyParser: false },
};

module.exports = async (req, res) => {
    console.log('[API Informar Pagamento] Iniciando...');
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const form = new IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error("[ERRO] Parsing form:", err);
            return res.status(500).json({ message: "Erro ao processar formulário." });
        }

        const sessionToken = Array.isArray(fields.sessionToken) ? fields.sessionToken[0] : fields.sessionToken;
        const designerIdRaw = Array.isArray(fields.designerId) ? fields.designerId[0] : fields.designerId;
        const valorRaw = Array.isArray(fields.valor) ? fields.valor[0] : fields.valor;
        let comprovanteUrl = Array.isArray(fields.comprovanteUrl) ? fields.comprovanteUrl[0] : fields.comprovanteUrl;
        const comprovanteFile = files.comprovanteFile ? (Array.isArray(files.comprovanteFile) ? files.comprovanteFile[0] : files.comprovanteFile) : null;

        console.log(`[DADOS] Designer: ${designerIdRaw}, Valor: ${valorRaw}, Tem Arquivo: ${!!comprovanteFile}, Tem Link: ${!!comprovanteUrl}`);

        if (!sessionToken || !designerIdRaw || !valorRaw) {
            return res.status(400).json({ message: 'Dados incompletos (Token, Designer ou Valor).' });
        }

        try {
            // 1. Validar Empresa
            const empresas = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);

            if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
            const empresaId = empresas[0].id;

            // 2. Upload do Comprovante (se houver arquivo físico)
            if (comprovanteFile) {
                console.log('[UPLOAD] Enviando comprovante para Vercel Blob...');
                try {
                    const fileStream = fs.createReadStream(comprovanteFile.filepath);
                    const blob = await put(`comprovantes/${Date.now()}-${comprovanteFile.originalFilename}`, fileStream, {
                        access: 'public',
                    });
                    comprovanteUrl = blob.url;
                    console.log('[UPLOAD] Sucesso:', comprovanteUrl);
                } catch (uploadError) {
                    console.error("[ERRO] Upload Vercel Blob:", uploadError);
                    return res.status(500).json({ message: "Erro ao salvar arquivo de comprovante." });
                }
            }

            // 3. Criar a linha de "Pagamento Genérico" (Conta Corrente)
            const valorEnviado = parseFloat(valorRaw.replace(',', '.'));
            const desId = parseInt(designerIdRaw);

            console.log(`[BANCO] Inserindo pagamento de R$${valorEnviado} na carteira...`);
            await prisma.$executeRawUnsafe(`
                INSERT INTO acertos_contas (empresa_id, designer_id, pedido_id, valor, status, comprovante_url, criado_em, pago_em)
                VALUES ($1, $2, NULL, $3, 'AGUARDANDO_CONFIRMACAO', $4, NOW(), NOW())
            `, empresaId, desId, valorEnviado, comprovanteUrl || null);

            console.log('[API Informar Pagamento] Finalizado com sucesso!');
            return res.status(200).json({ success: true, message: 'Pagamento enviado ao designer para confirmação!', comprovanteUrl });

        } catch (error) {
            console.error("[ERRO] Informar pagamento:", error);
            return res.status(500).json({ message: 'Erro interno ao processar pagamento.' });
        }
    });
};
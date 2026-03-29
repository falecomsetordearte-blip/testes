// api/designer/confirmarPagamento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    console.log('[API Confirmar Pagamento Ledger] Iniciando...');
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { token, pagamentoId, acao } = req.body;
    if (!token || !pagamentoId || !acao) return res.status(400).json({ message: 'Dados incompletos.' });

    try {
        // 1. Identificar Designer
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        // 2. Buscar o registro do Pagamento COM TRAVA (Só processa se estiver AGUARDANDO_CONFIRMACAO)
        const pagamentos = await prisma.$queryRawUnsafe(`
            SELECT * FROM acertos_contas 
            WHERE id = $1 AND designer_id = $2 AND pedido_id IS NULL AND status = 'AGUARDANDO_CONFIRMACAO' LIMIT 1
        `, parseInt(pagamentoId), designerId);

        // Se clicar duas vezes, a segunda vez cai aqui e não duplica!
        if (pagamentos.length === 0) return res.status(400).json({ message: 'Este pagamento já foi processado anteriormente ou não existe.' });

        const pagamento = pagamentos[0];

        if (acao === 'RECUSAR') {
            console.log(`[PAGAMENTO] Designer recusou o pagamento ID ${pagamentoId}.`);
            await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET status = 'RECUSADO' WHERE id = $1`, pagamento.id);
            return res.status(200).json({ success: true, message: 'Pagamento recusado e devolvido para a gráfica.' });
        }

        if (acao === 'CONFIRMAR') {
            console.log(`[PAGAMENTO] Designer confirmou R$${pagamento.valor}. Iniciando baixa (FIFO)...`);

            const artesPendentes = await prisma.$queryRawUnsafe(`
                SELECT id, valor FROM acertos_contas 
                WHERE designer_id = $1 AND empresa_id = $2 AND pedido_id IS NOT NULL AND status IN ('PENDENTE', 'LANCADO')
                ORDER BY criado_em ASC
            `, designerId, pagamento.empresa_id);

            let montanteRestante = parseFloat(pagamento.valor);

            for (const arte of artesPendentes) {
                if (montanteRestante <= 0) break;

                const valorArte = parseFloat(arte.valor);

                if (montanteRestante >= valorArte) {
                    await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET status = 'PAGO', pago_em = NOW() WHERE id = $1`, arte.id);
                    montanteRestante -= valorArte;
                } else {
                    await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET valor = $1 WHERE id = $2`, (valorArte - montanteRestante), arte.id);
                    await prisma.$executeRawUnsafe(`
                        INSERT INTO acertos_contas (empresa_id, designer_id, pedido_id, valor, status, pago_em, criado_em)
                        VALUES ($1, $2, $3, $4, 'PAGO', NOW(), NOW())
                    `, pagamento.empresa_id, designerId, arte.pedido_id, montanteRestante);
                    montanteRestante = 0;
                }
            }

            // Marca o comprovante principal como APROVADO
            await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET status = 'PAGO', pago_em = NOW() WHERE id = $1`, pagamento.id);
            console.log('[API Confirmar Pagamento Ledger] Sucesso!');

            return res.status(200).json({ success: true, message: 'Recebimento confirmado com sucesso!' });
        }

    } catch (error) {
        console.error("[ERRO] API confirmarPagamento:", error);
        return res.status(500).json({ message: 'Erro interno ao processar confirmação.' });
    }
};
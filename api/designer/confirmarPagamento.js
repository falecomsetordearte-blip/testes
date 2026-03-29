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

        // 2. Buscar o registro do Pagamento
        const pagamentos = await prisma.$queryRawUnsafe(`
            SELECT * FROM acertos_contas WHERE id = $1 AND designer_id = $2 AND pedido_id IS NULL LIMIT 1
        `, parseInt(pagamentoId), designerId);

        if (pagamentos.length === 0) return res.status(404).json({ message: 'Registro de pagamento não encontrado.' });
        const pagamento = pagamentos[0];

        if (acao === 'RECUSAR') {
            console.log(`[PAGAMENTO] Designer recusou o pagamento ID ${pagamentoId}.`);
            await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET status = 'RECUSADO' WHERE id = $1`, pagamento.id);
            return res.status(200).json({ success: true, message: 'Pagamento recusado e devolvido para a gráfica.' });
        }

        if (acao === 'CONFIRMAR') {
            console.log(`[PAGAMENTO] Designer confirmou R$${pagamento.valor}. Iniciando baixa (FIFO)...`);

            // A. Pega todas as artes pendentes dessa gráfica para esse designer
            const artesPendentes = await prisma.$queryRawUnsafe(`
                SELECT id, valor FROM acertos_contas 
                WHERE designer_id = $1 AND empresa_id = $2 AND pedido_id IS NOT NULL AND status IN ('PENDENTE', 'LANCADO')
                ORDER BY criado_em ASC
            `, designerId, pagamento.empresa_id);

            let montanteRestante = parseFloat(pagamento.valor);

            // B. Roda o FIFO para dar baixa nas artes
            for (const arte of artesPendentes) {
                if (montanteRestante <= 0) break;

                const valorArte = parseFloat(arte.valor);

                if (montanteRestante >= valorArte) {
                    console.log(`- Quitando arte ID ${arte.id} completa (R$${valorArte})`);
                    await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET status = 'PAGO', pago_em = NOW() WHERE id = $1`, arte.id);
                    montanteRestante -= valorArte;
                } else {
                    console.log(`- Quitando parcial arte ID ${arte.id}. Abatendo R$${montanteRestante} de R$${valorArte}`);
                    // Atualiza a arte atual com o valor que SOBROU devendo
                    await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET valor = $1 WHERE id = $2`, (valorArte - montanteRestante), arte.id);
                    // Insere o pedaço que foi pago
                    await prisma.$executeRawUnsafe(`
                        INSERT INTO acertos_contas (empresa_id, designer_id, pedido_id, valor, status, pago_em, criado_em)
                        VALUES ($1, $2, $3, $4, 'PAGO', NOW(), NOW())
                    `, pagamento.empresa_id, designerId, arte.pedido_id, montanteRestante);
                    montanteRestante = 0;
                }
            }

            // C. Marca o comprovante principal como APROVADO
            await prisma.$executeRawUnsafe(`UPDATE acertos_contas SET status = 'PAGO', pago_em = NOW() WHERE id = $1`, pagamento.id);
            console.log('[API Confirmar Pagamento Ledger] Sucesso!');

            return res.status(200).json({ success: true, message: 'Recebimento confirmado e dívidas abatidas!' });
        }

    } catch (error) {
        console.error("[ERRO] API confirmarPagamento:", error);
        return res.status(500).json({ message: 'Erro interno ao processar confirmação.' });
    }
};
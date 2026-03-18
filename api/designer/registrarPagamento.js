// api/designer/registrarPagamento.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { sessionToken, empresaId, valor } = req.body;
    const parsedEmpresaId = parseInt(empresaId);
    const parsedValor = parseFloat(valor);

    if (!sessionToken || isNaN(parsedEmpresaId) || isNaN(parsedValor)) {
        return res.status(400).json({ message: 'Dados inválidos ou incompletos (token, empresaId ou valor).' });
    }

    try {
        // 1. Identificar Designer
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (designers.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        // 2. Buscar acertos abertos (PENDENTE ou AGUARDANDO_CONFIRMACAO) dessa empresa
        // Ordenados por data (FIFO)
        const acertos = await prisma.acertoContas.findMany({
            where: {
                designer_id: designerId,
                empresa_id: parsedEmpresaId,
                status: { in: ['PENDENTE', 'AGUARDANDO_CONFIRMACAO'] }
            },
            orderBy: { criado_em: 'asc' }
        });

        let montanteRestante = parsedValor;
        const transacoes = [];

        for (const acerto of acertos) {
            if (montanteRestante <= 0) break;

            const valorAcerto = parseFloat(acerto.valor);

            if (montanteRestante >= valorAcerto) {
                // Quita o acerto totalmente
                transacoes.push(prisma.acertoContas.update({
                    where: { id: acerto.id },
                    data: { status: 'PAGO', pago_em: new Date() }
                }));
                montanteRestante -= valorAcerto;
            } else {
                // Quita parcialmente: 
                // 1. Atualiza o atual para o valor que SOBROU
                transacoes.push(prisma.acertoContas.update({
                    where: { id: acerto.id },
                    data: { valor: valorAcerto - montanteRestante }
                }));
                
                // 2. Cria um novo registro como PAGO com a parte recebida
                transacoes.push(prisma.acertoContas.create({
                    data: {
                        empresa_id: acerto.empresa_id,
                        designer_id: acerto.designer_id,
                        pedido_id: acerto.pedido_id,
                        valor: montanteRestante,
                        status: 'PAGO',
                        pago_em: new Date(),
                        comprovante_url: acerto.comprovante_url
                    }
                }));
                
                montanteRestante = 0;
            }
        }

        // Se sobrar valor (crédito extra que não tem acerto vinculante ainda)
        // Opcional: Criar um acerto negativo ou saldo de crédito. 
        // Por enquanto, vamos apenas processar o que existe.

        if (transacoes.length > 0) {
            await prisma.$transaction(transacoes);
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Pagamento registrado com sucesso!',
            saldo_restante: montanteRestante.toFixed(2)
        });

    } catch (error) {
        console.error("Erro API registrarPagamento:", error);
        return res.status(500).json({ message: 'Erro interno ao processar pagamento.' });
    }
};

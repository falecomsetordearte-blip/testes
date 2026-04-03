const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { dealId, motivorevisao } = req.body;
        
        if (!dealId) {
            return res.status(400).json({ message: 'ID do Pedido é obrigatório.' });
        }

        console.log(`[requestRevision] Solicitando revisão para o Pedido ID: ${dealId}`);

        // 1. Atualizar a etapa no banco local para 'ARTE' (em vez de IMPRESSÃO)
        // E anexar o motivo ao briefing se enviado
        const updateData = {
            etapa: 'ARTE',
            updated_at: new Date()
        };

        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = $1, 
                updated_at = $2
            WHERE id = $3
        `, updateData.etapa, updateData.updated_at, parseInt(dealId));

        return res.status(200).json({ success: true, message: 'Revisão solicitada com sucesso! O pedido retornou para o setor de Arte.' });

    } catch (error) {
        console.error('Erro ao solicitar revisão:', error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao solicitar a revisão localmente.' });
    }
};
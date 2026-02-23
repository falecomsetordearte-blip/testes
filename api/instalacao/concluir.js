// /api/instalacao/concluir.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, dealId } = req.body;

        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });

        // Muda para a etapa de EXPEDIÇÃO (Fim do fluxo)
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = 'EXPEDIÇÃO', updated_at = NOW() 
            WHERE id = $1
        `, parseInt(dealId));

        return res.status(200).json({ success: true, message: 'Instalação concluída com sucesso!' });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao concluir: ' + error.message });
    }
};
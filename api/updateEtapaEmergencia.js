const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Permite acesso de emergência
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { id, etapa } = req.body;

        if (!id || !etapa) {
            return res.status(400).json({ message: 'ID e Etapa são obrigatórios.' });
        }

        // Atualiza direto via SQL Puro no Neon
        await prisma.$executeRawUnsafe(`
            UPDATE pedidos 
            SET etapa = $1 
            WHERE id = $2
        `, etapa, parseInt(id));

        return res.status(200).json({ success: true, message: 'Etapa atualizada' });
        
    } catch (error) {
        console.error('Erro ao atualizar etapa:', error);
        return res.status(500).json({ message: error.message });
    }
};
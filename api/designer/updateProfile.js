// /api/designer/updateProfile.js - VERSÃO NEON 100%
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { token, nome, chave_pix, nova_senha } = req.body;

        // 1. Identificar Designer pelo Token de Sessão
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        // 2. Preparar campos para atualização
        let updateParts = [];
        let params = [];

        if (nome) { params.push(nome); updateParts.push(`nome = $${params.length}`); }
        if (chave_pix) { params.push(chave_pix); updateParts.push(`chave_pix = $${params.length}`); }
        
        if (nova_senha) {
            const hash = await bcrypt.hash(nova_senha, 10);
            params.push(hash);
            updateParts.push(`senha_hash = $${params.length}`);
        }

        if (updateParts.length === 0) return res.status(400).json({ message: 'Nada para atualizar.' });

        params.push(designerId);
        const query = `UPDATE designers_financeiro SET ${updateParts.join(', ')} WHERE designer_id = $${params.length}`;

        await prisma.$executeRawUnsafe(query, ...params);

        return res.status(200).json({ message: 'Perfil atualizado com sucesso!' });

    } catch (error) {
        console.error("Erro updateProfile:", error);
        return res.status(500).json({ message: 'Erro ao salvar alterações.' });
    }
};
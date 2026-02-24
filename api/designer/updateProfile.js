// /api/designer/updateProfile.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { token, nome, sobrenome, chave_pix, nova_senha } = req.body;

        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (designers.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });
        const designerId = designers[0].designer_id;

        let updateParts = [];
        let params = [];

        // Junta Nome e Sobrenome para salvar na coluna 'nome'
        if (nome || sobrenome) { 
            const nomeCompleto = `${nome || ''} ${sobrenome || ''}`.trim();
            params.push(nomeCompleto); 
            updateParts.push(`nome = $${params.length}`); 
        }

        if (chave_pix !== undefined) { 
            params.push(chave_pix); 
            updateParts.push(`chave_pix = $${params.length}`); 
        }
        
        if (nova_senha) {
            const hash = await bcrypt.hash(nova_senha, 10);
            params.push(hash);
            updateParts.push(`senha_hash = $${params.length}`);
        }

        if (updateParts.length === 0) return res.status(400).json({ message: 'Nada para atualizar.' });

        params.push(designerId);
        await prisma.$executeRawUnsafe(
            `UPDATE designers_financeiro SET ${updateParts.join(', ')} WHERE designer_id = $${params.length}`, 
            ...params
        );

        return res.status(200).json({ message: 'Perfil atualizado com sucesso!' });

    } catch (error) {
        console.error("Erro updateProfile:", error);
        return res.status(500).json({ message: 'Erro ao salvar alterações.' });
    }
};
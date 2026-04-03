// /api/designer/updateProfile.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { token, nome, sobrenome, email, chave_pix, nova_senha } = req.body;

        // 1. Identificar Designer pelo Token de Sessão
        const designers = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE session_tokens = $1 LIMIT 1
        `, token);

        if (designers.length === 0) return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
        const designerId = designers[0].designer_id;

        // 2. Preparar campos para atualização
        let updateParts = [];
        let params = [];

        // Atualização de Nome/Sobrenome
        if (nome !== undefined || sobrenome !== undefined) {
            const nomeCompleto = `${nome || ''} ${sobrenome || ''}`.trim();
            if (nomeCompleto) {
                params.push(nomeCompleto);
                updateParts.push(`nome = $${params.length}`);
            }
        }

        // Atualização de E-mail com Verificação de Duplicidade
        if (email) {
            const checkEmail = await prisma.$queryRawUnsafe(`
                SELECT designer_id FROM designers_financeiro WHERE email = $1 AND designer_id != $2 LIMIT 1
            `, email, designerId);
            
            if (checkEmail.length > 0) {
                return res.status(400).json({ message: 'Este e-mail já está sendo usado por outro usuário.' });
            }
            params.push(email);
            updateParts.push(`email = $${params.length}`);
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

        if (updateParts.length === 0) return res.status(400).json({ message: 'Nenhuma alteração detectada.' });

        // 3. Executar Update
        params.push(designerId);
        const query = `UPDATE designers_financeiro SET ${updateParts.join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE designer_id = $${params.length}`;

        await prisma.$executeRawUnsafe(query, ...params);

        return res.status(200).json({ message: 'Perfil atualizado com sucesso!' });

    } catch (error) {
        console.error("Erro updateProfile:", error);
        return res.status(500).json({ message: 'Erro interno ao salvar as alterações.' });
    }
};
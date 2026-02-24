// /api/designerRegister.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
        }

        const emailLimpo = email.trim().toLowerCase();

        // 1. Verifica se o e-mail já está cadastrado
        const designerExistente = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE LOWER(email) = $1 LIMIT 1
        `, emailLimpo);

        if (designerExistente.length > 0) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado. Faça login.' });
        }

        // 2. Cria o Hash da senha
        const senhaHash = await bcrypt.hash(senha, 10);

        // 3. Descobre o próximo ID disponível
        const maxIdResult = await prisma.$queryRawUnsafe(`
            SELECT MAX(designer_id) as max_id FROM designers_financeiro
        `);
        const nextId = (maxIdResult[0].max_id || 0) + 1;

        // 4. Insere o novo designer no banco (Incluindo atualizado_em, criado_em e aprovados para evitar erro NOT NULL)
        await prisma.$executeRawUnsafe(`
            INSERT INTO designers_financeiro 
            (
                designer_id, nome, email, senha_hash, nivel, 
                saldo_disponivel, saldo_pendente, pontuacao, aprovados, 
                criado_em, atualizado_em
            ) 
            VALUES (
                $1, $2, $3, $4, 3, 
                0.00, 0.00, 0, 0.00, 
                NOW(), NOW()
            )
        `, nextId, nome.trim(), emailLimpo, senhaHash);

        // 5. Gera o Token JWT para login automático
        const newToken = jwt.sign(
            { designerId: nextId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 6. Salva a sessão no banco
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro SET session_tokens = $1 WHERE designer_id = $2
        `, newToken, nextId);

        // 7. Retorna sucesso
        return res.status(201).json({ 
            message: 'Cadastro realizado com sucesso!',
            token: newToken, 
            designer: {
                id: nextId,
                name: nome.trim(),
                nivel: 3
            }
        });

    } catch (error) {
        console.error('[REGISTER ERROR] Erro interno:', error);
        return res.status(500).json({ message: 'Erro interno ao criar conta.' });
    }
};
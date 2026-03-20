// /api/designer/register.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        // Agora recebemos a chave_pix também
        const { nome, email, senha, chave_pix } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ message: 'Preencha Nome, E-mail e Senha.' });
        }

        // 1. Verifica se o e-mail já existe
        const check = await prisma.$queryRawUnsafe(`
            SELECT designer_id FROM designers_financeiro WHERE email = $1 LIMIT 1
        `, email);
        
        if (check.length > 0) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado no sistema.' });
        }

        // 2. Criptografa a senha
        const hash = await bcrypt.hash(senha, 10);

        // 3. Insere o novo designer (GARANTINDO QUE NADA SEJA NULL)
        // Usamos RETURNING designer_id para não precisar fazer um SELECT logo depois
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO designers_financeiro (
                nome, email, senha_hash, chave_pix,
                nivel, saldo_disponivel, saldo_pendente, pontuacao, aprovados,
                assinatura_status, session_tokens, reset_token, 
                asaas_customer_id, asaas_subscription_id,
                criado_em, atualizado_em
            ) VALUES (
                $1, $2, $3, $4, 
                3, 0.00, 0.00, 0, 0.00, 
                'INATIVO', '', '', 
                '', '',
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING designer_id
        `, nome, email, hash, chave_pix || '');

        const designerId = insertResult[0].designer_id;

        // 4. Gera e salva o Token 
        const token = jwt.sign({ designerId }, JWT_SECRET, { expiresIn: '7d' });
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET session_tokens = $1 
            WHERE designer_id = $2
        `, token, designerId);

        return res.status(200).json({ 
            message: 'Conta criada com sucesso!', 
            token: token, 
            nome: nome, 
            nivel: 3 
        });

    } catch (error) {
        console.error('Erro no register.js:', error);
        return res.status(500).json({ message: 'Erro interno ao criar conta. Verifique o console.' });
    }
};
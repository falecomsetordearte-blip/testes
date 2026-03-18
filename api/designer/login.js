// /api/designer/login.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    // Permite CORS caso seja necessário
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        // 1. Busca o usuário no Neon
        const users = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome, senha_hash, nivel, assinatura_status 
            FROM designers_financeiro 
            WHERE email = $1 LIMIT 1
        `, email);

        if (users.length === 0) {
            // Mensagem genérica por segurança (não revelar se o email existe ou não)
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        const user = users[0];

        // 2. Verifica se a senha bate com a criptografada no banco
        const senhaValida = await bcrypt.compare(senha, user.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        // 3. Gera o token de sessão (JWT)
        const token = jwt.sign({ designerId: user.designer_id }, JWT_SECRET, { expiresIn: '7d' });

        // 4. Salva o token na coluna session_tokens das tabelas envolvidas
        // Salva na painel_usuarios (para compatibilidade futura)
        await prisma.$executeRawUnsafe(`
            UPDATE painel_usuarios 
            SET session_tokens = $1 
            WHERE id = $2
        `, token, user.designer_id);

        // Salva na designers_financeiro (garantido que funciona para designers)
        await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro 
            SET session_tokens = $1 
            WHERE designer_id = $2
        `, token, user.designer_id);

        // 5. Retorna sucesso para o Front-end
        return res.status(200).json({
            message: 'Login realizado com sucesso!',
            token: token,
            nome: user.nome,
            nivel: user.nivel || 3,
            assinaturaStatus: user.assinatura_status || 'INATIVO'
        });

    } catch (error) {
        console.error('Erro fatal no login.js:', error);
        return res.status(500).json({ message: 'Erro interno ao tentar fazer o login. Tente novamente.' });
    }
};
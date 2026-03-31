// /api/designer/login.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    console.log('[LOGIN_API] -> Recebendo requisição de login...');

    // Permite CORS caso seja necessário
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        console.log('[LOGIN_API] -> Método OPTIONS respondido com sucesso (CORS).');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.warn(`[LOGIN_API] -> Método não permitido: ${req.method}`);
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { email, senha } = req.body;
        console.log(`[LOGIN_API] -> Tentativa de login para o email: ${email}`);

        if (!email || !senha) {
            console.warn('[LOGIN_API] -> Falha: E-mail e senha não fornecidos.');
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        // 1. Busca o usuário no Neon
        console.log('[LOGIN_API] -> Buscando usuário no banco de dados (designers_financeiro)...');
        const users = await prisma.$queryRawUnsafe(`
            SELECT designer_id, nome, senha_hash, nivel, assinatura_status 
            FROM designers_financeiro 
            WHERE email = $1 LIMIT 1
        `, email);

        if (users.length === 0) {
            console.warn(`[LOGIN_API] -> Usuário não encontrado para o email: ${email}`);
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        const user = users[0];
        console.log(`[LOGIN_API] -> Usuário encontrado: ID ${user.designer_id} - ${user.nome}. Verificando senha...`);

        // 2. Verifica se a senha bate com a criptografada no banco
        const senhaValida = await bcrypt.compare(senha, user.senha_hash);
        if (!senhaValida) {
            console.warn(`[LOGIN_API] -> Senha incorreta para o usuário: ${email}`);
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }

        // 3. Gera o token de sessão (JWT)
        console.log(`[LOGIN_API] -> Senha válida. Gerando token JWT para o designer ID: ${user.designer_id}`);
        const token = jwt.sign({ designerId: user.designer_id }, JWT_SECRET, { expiresIn: '7d' });

        // 4. Salva o token na coluna session_tokens das tabelas envolvidas
        console.log('[LOGIN_API] -> Atualizando tokens de sessão nas tabelas painel_usuarios e designers_financeiro...');

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

        console.log(`[LOGIN_API] -> Login concluído com sucesso para: ${user.nome}. Retornando dados ao front-end.`);

        // 5. Retorna sucesso para o Front-end
        return res.status(200).json({
            message: 'Login realizado com sucesso!',
            token: token,
            nome: user.nome,
            nivel: user.nivel || 3,
            assinaturaStatus: user.assinatura_status || 'INATIVO'
        });

    } catch (error) {
        console.error('[LOGIN_API] -> Erro fatal no login.js:', error);
        return res.status(500).json({ message: 'Erro interno ao tentar fazer o login. Tente novamente.' });
    }
};
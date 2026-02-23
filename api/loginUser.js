const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Cabeçalhos de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        // 1. Buscar a empresa direto no banco NEON
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT * FROM empresas WHERE email = $1 LIMIT 1
        `, email);

        if (empresas.length === 0) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        const empresa = empresas[0];

        // 2. Lidar com clientes antigos sem senha no Neon
        if (!empresa.senha) {
            return res.status(401).json({ 
                message: 'Sistema atualizado! Por favor, clique em "Esqueceu sua senha?" para criar uma nova senha e recuperar seu acesso.' 
            });
        }

        // 3. Comparar a senha digitada com a senha salva no Neon
        const isMatch = await bcrypt.compare(senha, empresa.senha);

        if (!isMatch) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        // 4. Gerar e Salvar o Token de Sessão no Neon
        const newSessionToken = randomBytes(32).toString('hex');
        const existingTokens = empresa.session_tokens || '';
        
        const updatedTokens = existingTokens
            ? `${existingTokens.trim()},${newSessionToken}`
            : newSessionToken;

        // Atualiza os tokens da empresa
        await prisma.$executeRawUnsafe(`
            UPDATE empresas SET session_tokens = $1 WHERE id = $2
        `, updatedTokens, empresa.id);

        // 5. Retornar sucesso
        return res.status(200).json({ 
            token: newSessionToken, 
            userName: empresa.nome_fantasia || empresa.responsavel || email 
        });

    } catch (error) {
        console.error('Erro no processo de login:', error);
        return res.status(500).json({ 
            message: 'Ocorreu um erro interno no servidor.' 
        });
    }
};
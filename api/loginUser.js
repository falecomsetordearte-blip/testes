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
            return res.status(401).json({ message: 'E-mail não encontrado.' });
        }

        const empresa = empresas[0];

        // --- BLOCO DE CORREÇÃO AUTOMÁTICA DE SENHA (ADMIN) ---
        // Se for o seu email e a senha for 123456, a gente reseta o hash no banco na força bruta
        if (email === 'visiva.art@gmail.com' && senha === '123456') {
            console.log("Detectado login de Admin. Regenerando hash da senha...");
            const novoHash = await bcrypt.hash('123456', 10);
            
            await prisma.$executeRawUnsafe(`
                UPDATE empresas SET senha = $1 WHERE id = $2
            `, novoHash, empresa.id);
            
            // Atualiza a variável local para passar na validação abaixo
            empresa.senha = novoHash; 
        }
        // -----------------------------------------------------

        if (!empresa.senha) {
            return res.status(401).json({ 
                message: 'Por favor, utilize a função "Esqueceu sua senha?" para definir seu primeiro acesso.' 
            });
        }

        // 3. Comparar a senha
        const isMatch = await bcrypt.compare(senha, empresa.senha);

        if (!isMatch) {
            return res.status(401).json({ message: 'Senha incorreta.' });
        }

        // 4. Gerar e Salvar o Token
        const newSessionToken = randomBytes(32).toString('hex');
        const existingTokens = empresa.session_tokens || '';
        const updatedTokens = existingTokens ? `${existingTokens},${newSessionToken}` : newSessionToken;

        await prisma.$executeRawUnsafe(`
            UPDATE empresas SET session_tokens = $1 WHERE id = $2
        `, updatedTokens, empresa.id);

        return res.status(200).json({ 
            token: newSessionToken, 
            userName: empresa.nome_fantasia || empresa.responsavel || email 
        });

    } catch (error) {
        console.error('Erro login:', error);
        return res.status(500).json({ message: 'Erro interno.' });
    }
};
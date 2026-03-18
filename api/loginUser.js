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

        // 1. Tentar buscar primeiro na NOVA tabela (painel_usuarios)
        let isNovoUsuario = true;
        let usuario = null;

        const usuariosNovos = await prisma.$queryRawUnsafe(`
            SELECT u.*, f.permissoes, df.assinatura_status 
            FROM painel_usuarios u
            LEFT JOIN painel_funcoes f ON u.funcao_id = f.id
            LEFT JOIN designers_financeiro df ON df.designer_id = u.id
            WHERE u.email = $1 LIMIT 1
        `, email);

        if (usuariosNovos.length > 0) {
            usuario = usuariosNovos[0];
        } else {
            // Se não achou na nova, busca na ANTIGA (empresas)
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT *, assinatura_status FROM empresas WHERE email = $1 LIMIT 1
            `, email);

            if (empresasLegacy.length > 0) {
                isNovoUsuario = false;
                usuario = empresasLegacy[0];
            }
        }

        // Se realmente não achar em nenhuma das duas
        if (!usuario) {
            return res.status(401).json({ message: 'E-mail não encontrado.' });
        }

        // --- BLOCO DE CORREÇÃO AUTOMÁTICA DE SENHA (ADMIN) ---
        if (email === 'visiva.art@gmail.com' && senha === '123456') {
            const novoHash = await bcrypt.hash('123456', 10);
            const tabela = isNovoUsuario ? 'painel_usuarios' : 'empresas';
            await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET ${isNovoUsuario ? 'senha_hash' : 'senha'} = $1 WHERE id = $2`, novoHash, usuario.id);
            if (isNovoUsuario) usuario.senha_hash = novoHash; else usuario.senha = novoHash;
        }

        const passToCompare = isNovoUsuario ? usuario.senha_hash : usuario.senha;
        if (!passToCompare) {
            return res.status(401).json({ message: 'Senha não definida.' });
        }

        // 3. Comparar a senha
        const isMatch = await bcrypt.compare(senha, passToCompare);
        if (!isMatch) {
            return res.status(401).json({ message: 'Senha incorreta.' });
        }

        // 4. Gerar e Salvar o Token
        const newSessionToken = randomBytes(32).toString('hex');
        const existingTokens = usuario.session_tokens || '';
        const updatedTokens = existingTokens ? `${existingTokens},${newSessionToken}` : newSessionToken;

        if (isNovoUsuario) {
            await prisma.$executeRawUnsafe(`UPDATE painel_usuarios SET session_tokens = $1 WHERE id = $2`, updatedTokens, usuario.id);
        } else {
            await prisma.$executeRawUnsafe(`UPDATE empresas SET session_tokens = $1 WHERE id = $2`, updatedTokens, usuario.id);
        }

        let permissoesFinal = null;
        if (usuario.permissoes) {
            permissoesFinal = typeof usuario.permissoes === 'string'
                ? JSON.parse(usuario.permissoes)
                : usuario.permissoes;
        }

        return res.status(200).json({
            token: newSessionToken,
            userName: usuario.nome || usuario.nome_fantasia || usuario.responsavel || email,
            permissoes: permissoesFinal,
            tipoAcesso: isNovoUsuario ? 'NOVO' : 'LEGACY',
            assinaturaStatus: usuario.assinatura_status || 'INATIVO'
        });

    } catch (error) {
        console.error('Erro login:', error);
        return res.status(500).json({ message: 'Erro interno.' });
    }
};
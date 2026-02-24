// /api/designer/getProfile.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { token } = req.body;
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

        // 1. Decodificar o token 
        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);

        // 2. Buscar 100% dos dados no Neon
        const designers = await prisma.$queryRawUnsafe(`
            SELECT nome, chave_pix, pontuacao
            FROM designers_financeiro 
            WHERE designer_id = $1 LIMIT 1
        `, designerId);

        if (designers.length === 0) {
            return res.status(404).json({ message: 'Perfil não encontrado.' });
        }

        const dbData = designers[0];
        const nomeCompleto = dbData.nome || 'Designer';
        
        // Separa o nome do sobrenome para preencher os campos do formulário
        const nomeParts = nomeCompleto.split(' ');
        const name = nomeParts[0];
        const lastName = nomeParts.slice(1).join(' ');

        // Cria um avatar automático com as letras iniciais do designer
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeCompleto)}&background=e0e7ff&color=4f46e5&size=120`;

        // 3. Retornar os dados
        return res.status(200).json({
            name: name,
            lastName: lastName,
            avatar: avatarUrl,
            chave_pix: dbData.chave_pix || '',
            pontuacao: dbData.pontuacao || 0
        });

    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
        }
        return res.status(500).json({ message: 'Erro interno ao buscar perfil.' });
    }
};
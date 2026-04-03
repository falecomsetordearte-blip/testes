// /api/designer/getProfile.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { token } = req.body;
        if (!token) return res.status(401).json({ message: 'Token de autenticação não fornecido.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);

        if (!designerId) return res.status(401).json({ message: 'Token inválido ou expirado.' });

        const designers = await prisma.$queryRawUnsafe(`
            SELECT nome, email, chave_pix, pontuacao
            FROM designers_financeiro 
            WHERE designer_id = $1 LIMIT 1
        `, designerId);

        if (designers.length === 0) {
            return res.status(404).json({ message: 'Perfil não encontrado no banco de dados.' });
        }

        const dbData = designers[0];
        const nomeCompleto = dbData.nome || 'Designer';
        
        // Separa Nome e Sobrenome para os inputs do HTML
        const nomeParts = nomeCompleto.trim().split(' ');
        const name = nomeParts[0];
        const lastName = nomeParts.slice(1).join(' ');

        // Cria avatar com as iniciais
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeCompleto)}&background=e0e7ff&color=4f46e5&size=120`;

        return res.status(200).json({
            name: name,
            lastName: lastName,
            email: dbData.email || '',
            avatar: avatarUrl,
            chave_pix: dbData.chave_pix || '',
            pontuacao: dbData.pontuacao || 0
        });

    } catch (error) {
        console.error("Erro ao buscar perfil do designer:", error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
        }
        return res.status(500).json({ message: 'Ocorreu um erro interno ao buscar os dados.' });
    }
};
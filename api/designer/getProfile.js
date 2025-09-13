// /api/designer/getProfile.js
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // A API agora usa POST para receber o token no corpo, mantendo consistência
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { token } = req.body;
        if (!token) {
            return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
        }

        // 1. Decodificar o token para obter o ID do designer
        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);

        if (!designerId) {
            return res.status(401).json({ message: 'Token inválido ou expirado.' });
        }

        // 2. Buscar dados do Bitrix24 e do Banco de Dados em paralelo
        const [bitrixResponse, dbData] = await Promise.all([
            axios.post(`${BITRIX24_API_URL}user.get`, { ID: designerId }),
            prisma.designerFinanceiro.findUnique({
                where: { designer_id: designerId }
            })
        ]);

        const designerBitrix = bitrixResponse.data.result[0];

        if (!designerBitrix) {
            return res.status(404).json({ message: 'Designer não encontrado no Bitrix24.' });
        }
        if (!dbData) {
            // Se o registro não existe, podemos criar um básico para evitar erros futuros
            const newDbData = await prisma.designerFinanceiro.create({
                data: { designer_id: designerId }
            });
            return res.status(200).json({
                name: designerBitrix.NAME,
                lastName: designerBitrix.LAST_NAME,
                avatar: designerBitrix.PERSONAL_PHOTO,
                chave_pix: newDbData.chave_pix || '',
                pontuacao: newDbData.pontuacao
            });
        }
        
        // 3. Unir os dados de ambas as fontes
        const profileData = {
            name: designerBitrix.NAME,
            lastName: designerBitrix.LAST_NAME,
            avatar: designerBitrix.PERSONAL_PHOTO,
            chave_pix: dbData.chave_pix || '',
            pontuacao: dbData.pontuacao
        };

        return res.status(200).json(profileData);

    } catch (error) {
        console.error("Erro ao buscar perfil do designer:", error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token inválido.' });
        }
        return res.status(500).json({ message: 'Ocorreu um erro interno ao buscar os dados do perfil.' });
    }
};
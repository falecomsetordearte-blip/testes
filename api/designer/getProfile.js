// /api/designer/getProfile.js
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // A API agora usa GET, pois apenas busca dados
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);

        // Busca dados do Bitrix24 e do nosso DB em paralelo
        const [bitrixUserResponse, financeiro] = await Promise.all([
            axios.post(`${BITRIX24_API_URL}user.get.json`, { ID: designerId }),
            prisma.designerFinanceiro.findUnique({ where: { designer_id: designerId } })
        ]);

        const bitrixUser = bitrixUserResponse.data.result[0];
        if (!bitrixUser) {
            return res.status(404).json({ message: "Usuário não encontrado no Bitrix24." });
        }

        const profileData = {
            nome: bitrixUser.NAME,
            sobrenome: bitrixUser.LAST_NAME,
            foto: bitrixUser.PERSONAL_PHOTO,
            pontuacao: bitrixUser.UF_USR_1744662446097 || 'N/A', // Campo PONTUAÇÃO
            chave_pix: financeiro?.chave_pix || '' // Pega a Chave PIX do nosso banco de dados
        };

        res.status(200).json(profileData);

    } catch (error) {
        console.error("Erro ao buscar perfil do designer:", error);
        res.status(500).json({ message: 'Erro ao buscar dados do perfil.' });
    }
};
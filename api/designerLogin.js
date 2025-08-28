// /api/designerLogin.js - VERSÃO CORRETA E FINAL (USA NEON DB)

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        // ETAPA 1: Encontrar o designer no Bitrix24 pelo e-mail para obter o ID
        const userSearchResponse = await axios.post(`${BITRIX24_API_URL}user.get.json`, {
            FILTER: { "EMAIL": email }
        });

        const designerBitrix = userSearchResponse.data.result[0];
        if (!designerBitrix) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }
        const designerId = parseInt(designerBitrix.ID, 10);
        
        // ETAPA 2: Buscar o registro financeiro (e a senha) no nosso banco de dados Neon
        const designerFinanceiro = await prisma.designerFinanceiro.findUnique({
            where: { designer_id: designerId },
        });

        const storedHash = designerFinanceiro?.senha_hash;
        if (!storedHash) {
            return res.status(401).json({ message: 'Este usuário não possui uma senha configurada. Por favor, use a opção "Esqueci minha senha".' });
        }

        // ETAPA 3: Comparar a senha fornecida com o hash armazenado
        const isMatch = await bcrypt.compare(senha, storedHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        // ETAPA 4: Se a senha estiver correta, criar o token JWT
        const designerData = {
            id: designerBitrix.ID,
            name: designerBitrix.NAME,
            lastName: designerBitrix.LAST_NAME,
            email: designerBitrix.EMAIL,
            avatar: designerBitrix.PERSONAL_PHOTO
        };

        const sessionToken = jwt.sign(
            { designerId: designerData.id, name: designerData.name },
            JWT_SECRET, 
            { expiresIn: '1d' }
        );

        return res.status(200).json({ 
            token: sessionToken,
            designer: designerData
        });

    } catch (error) {
        console.error('Erro no login do designer:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
    }
};

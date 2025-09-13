// /api/designer/updateProfile.js
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { token, nome, sobrenome, chave_pix, nova_senha } = req.body;
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

        // 1. Validar o token e obter o ID do designer
        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);
        if (!designerId) return res.status(401).json({ message: 'Token inválido.' });

        // 2. Preparar os dados para as atualizações
        const bitrixUpdateData = {};
        if (nome) bitrixUpdateData.NAME = nome;
        if (sobrenome) bitrixUpdateData.LAST_NAME = sobrenome;

        const prismaUpdateData = {};
        if (chave_pix !== undefined) prismaUpdateData.chave_pix = chave_pix;
        
        // Se uma nova senha foi fornecida, criptografa-a
        if (nova_senha) {
            prismaUpdateData.senha_hash = await bcrypt.hash(nova_senha, 10);
        }

        // 3. Executar as atualizações em paralelo
        const promises = [];

        // Adiciona a promessa de atualização do Bitrix24 se houver dados a serem atualizados
        if (Object.keys(bitrixUpdateData).length > 0) {
            promises.push(
                axios.post(`${BITRIX24_API_URL}user.update`, {
                    ID: designerId,
                    ...bitrixUpdateData
                })
            );
        }

        // Adiciona a promessa de atualização do Prisma se houver dados a serem atualizados
        if (Object.keys(prismaUpdateData).length > 0) {
            promises.push(
                prisma.designerFinanceiro.update({
                    where: { designer_id: designerId },
                    data: prismaUpdateData
                })
            );
        }

        // Aguarda a conclusão de todas as promessas
        await Promise.all(promises);

        return res.status(200).json({ message: 'Perfil atualizado com sucesso!' });

    } catch (error) {
        console.error("Erro ao atualizar perfil do designer:", error);
        if (error.code === 'P2025') {
             return res.status(404).json({ message: 'Registro financeiro do designer não encontrado para atualização.' });
        }
        return res.status(500).json({ message: 'Ocorreu um erro interno ao salvar as alterações.' });
    }
};
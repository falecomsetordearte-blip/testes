// /api/resetPassword.js
const axios = require('axios');
const bcrypt = require('bcryptjs');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { token, novaSenha } = req.body;
        if (!token || !novaSenha) {
            return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
        }

        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'UF_CRM_1756285759050': token }, // Campo RESET TOKEN atualizado
            select: ['ID', 'UF_CRM_1756285813385'] // Campo RESET EXPIRES atualizado
        });

        const user = userSearch.data.result[0];
        if (!user) {
            return res.status(400).json({ message: 'Token de redefinição inválido ou já utilizado.' });
        }

        const tokenExpires = new Date(user.UF_CRM_1756285813385);
        if (tokenExpires < new Date()) {
            return res.status(400).json({ message: 'Token expirado. Por favor, solicite um novo link.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(novaSenha, salt);

        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: user.ID,
            fields: {
                'UF_CRM_1751824202': newHashedPassword, // O campo da senha (permanece o mesmo)
                'UF_CRM_1756285759050': '', // Limpa o token
                'UF_CRM_1756285813385': '' // Limpa a expiração
            }
        });

        return res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error)
    {
        console.error('Erro em resetPassword:', error);
        return res.status(500).json({ message: 'Ocorreu um erro interno.' });
    }
};

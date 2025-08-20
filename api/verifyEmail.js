const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token de verificação não fornecido.' });
        }

        // ETAPA 1: Encontrar o contato pelo token
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 'UF_CRM_1751824225': token }, // Procura pelo Session Token
            select: ['ID', 'UF_CRM_1751829758'] // Pega o ID e o status de Verificado
        });

        const contact = searchUserResponse.data.result[0];

        if (!contact) {
            return res.status(404).json({ message: 'Token de verificação inválido ou expirado.' });
        }

        // Se o contato já está verificado (valor é 1), não faz nada.
        // Usamos '==' para comparar, pois o Bitrix pode retornar o número como texto "1".
        if (contact.UF_CRM_1751829758 == 1) {
            return res.status(200).json({ status: 'success', message: 'E-mail já havia sido verificado.' });
        }

        // ETAPA 2: Atualizar o campo "Verificado" para 1 (Sim)
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: contact.ID,
            fields: {
                'UF_CRM_1751829758': '1' // Define o valor como 1
            }
        });

        // ETAPA FINAL: Retornar sucesso
        return res.status(200).json({ status: 'success', message: 'E-mail verificado com sucesso!' });

    } catch (error) {
        console.error('Erro na verificação de e-mail:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno ao verificar seu e-mail.' });
    }
};

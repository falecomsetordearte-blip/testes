const axios = require('axios');
const bcrypt =require('bcryptjs');
const { randomBytes } = require('crypto');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        // ETAPA 1: Buscar o usuário pelo CAMPO DE E-MAIL PADRÃO, tipo WORK
        const searchUserResponse = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { 
                'EMAIL': email,
                'EMAIL_VALUE_TYPE': 'WORK'
            },
            select: ['ID', 'NAME', 'UF_CRM_1751824202', 'UF_CRM_1751824225']
        });

        const user = searchUserResponse.data.result[0];

        if (!user) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        const storedHash = user.UF_CRM_1751824202;
        if (!storedHash) {
            return res.status(401).json({ message: 'Conta não configurada para login. Por favor, contate o suporte.' });
        }

        // ETAPA 2: Comparar a senha enviada com o hash salvo
        const isMatch = await bcrypt.compare(senha, storedHash);

        if (!isMatch) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        // ETAPA 3: Gerar novo token e adicionar à lista
        const newSessionToken = randomBytes(32).toString('hex');
        const existingTokens = user.UF_CRM_1751824225 || '';
        const updatedTokens = existingTokens ? `${existingTokens.trim()},${newSessionToken}` : newSessionToken;

        // Atualiza o contato com o novo token
        await axios.post(`${BITRIX24_API_URL}crm.contact.update.json`, {
            id: user.ID,
            fields: {
                'UF_CRM_1751824225': updatedTokens
            }
        });

        // ETAPA FINAL: Enviar o novo token
        return res.status(200).json({ 
            token: newSessionToken, 
            userName: user.NAME || email 
        });

    } catch (error) {
        console.error('Erro no processo de login:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente mais tarde.' });
    }


    } catch (error) {
        console.error('Erro no processo de login:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente mais tarde.' });
    }
};

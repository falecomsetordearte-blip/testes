// /api/designerLogin.js

const axios = require('axios');
const jwt = require('jsonwebtoken'); // Usaremos JWT para a sessão

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const JWT_SECRET = process.env.JWT_SECRET; // Um novo segredo que você precisa adicionar na Vercel

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        // ETAPA 1: Autenticar no Bitrix24
        // A API do Bitrix24 não tem um endpoint "login". Usamos um truque:
        // Tentamos fazer uma chamada que requer autenticação. Se funcionar, as credenciais são válidas.
        // A chamada mais simples é 'profile'.
        const authString = Buffer.from(`${email}:${senha}`).toString('base64');
        
        let profileData;
        try {
            const profileResponse = await axios.get(`${BITRIX24_API_URL}profile.json`, {
                headers: { 'Authorization': `Basic ${authString}` }
            });
            profileData = profileResponse.data.result;
        } catch (authError) {
            // Se der erro 401 (Unauthorized), significa que a senha ou email estão errados.
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        // ETAPA 2: Se a autenticação funcionou, criar um token de sessão seguro (JWT)
        const designer = {
            id: profileData.ID,
            name: profileData.NAME,
            lastName: profileData.LAST_NAME,
            email: profileData.EMAIL,
            avatar: profileData.PERSONAL_PHOTO
        };

        const sessionToken = jwt.sign(
            { designerId: designer.id }, 
            JWT_SECRET, 
            { expiresIn: '1d' } // Token expira em 1 dia
        );

        return res.status(200).json({ 
            token: sessionToken,
            designer: designer
        });

    } catch (error) {
        console.error('Erro no login do designer:', error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
    }
};

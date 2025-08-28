// /api/designerLogin.js - VERSÃO COM DEPURAÇÃO DETALHADA

const axios = require('axios');
const jwt = require('jsonwebtoken');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    console.log("--- [LOGIN DESIGNER] Nova tentativa de login ---");
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }
        console.log(`[DEBUG] Tentando autenticar com o e-mail: ${email}`);

        // ETAPA 1: Tentar autenticar no Bitrix24
        const authString = Buffer.from(`${email}:${senha}`).toString('base64');
        
        let profileData;
        try {
            console.log("[DEBUG] Enviando requisição para profile.json...");
            const profileResponse = await axios.get(`${BITRIX24_API_URL}profile.json`, {
                headers: { 'Authorization': `Basic ${authString}` }
            });
            profileData = profileResponse.data.result;
            console.log("[DEBUG] Autenticação no Bitrix24 bem-sucedida. Perfil recebido:", profileData);

        } catch (authError) {
            // PONTO DE VERIFICAÇÃO CRÍTICO: O QUE O BITRIX24 RESPONDEU?
            console.error("[ERRO DE AUTENTICAÇÃO] A chamada para profile.json falhou.");
            if (authError.response) {
                // Se o Bitrix24 respondeu, logamos o status e os dados
                console.error(`[DEBUG] Status da resposta de erro: ${authError.response.status}`);
                console.error("[DEBUG] Corpo da resposta de erro:", authError.response.data);
            } else {
                // Se foi um erro de rede ou outro, logamos a mensagem
                console.error("[DEBUG] Erro sem resposta do servidor:", authError.message);
            }

            // A lógica de falha de login deve estar AQUI DENTRO do catch
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        // Se o código chegou até aqui, a autenticação foi um sucesso.
        // ETAPA 2: Criar token de sessão JWT
        console.log("[DEBUG] Criando token JWT para o designer ID:", profileData.ID);
        const designer = {
            id: profileData.ID,
            name: profileData.NAME,
            lastName: profileData.LAST_NAME,
            email: profileData.EMAIL,
            avatar: profileData.PERSONAL_PHOTO
        };

        const sessionToken = jwt.sign(
            { designerId: designer.id, name: designer.name }, // Adicionando o nome ao token
            JWT_SECRET, 
            { expiresIn: '1d' }
        );

        console.log("--- [LOGIN DESIGNER] Login bem-sucedido ---");
        return res.status(200).json({ 
            token: sessionToken,
            designer: designer
        });

    } catch (error) {
        // Este catch pega erros inesperados, não erros de autenticação
        console.error('--- [ERRO CRÍTICO] Erro inesperado no fluxo de login do designer ---');
        console.error(error);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
    }
};

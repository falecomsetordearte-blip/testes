// Importa a biblioteca do Stream
const { StreamChat } = require('stream-chat');

// ===================================================================
// ATENÇÃO: COLOQUE SUAS CHAVES DO STREAM AQUI
// ESTA É A FORMA SEGURA DE FAZER ISSO NA VERCEL
// ===================================================================
const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;
// ===================================================================

// Esta é a função que a Vercel vai executar
module.exports = async (req, res) => {
    // Verifica se as chaves foram configuradas no ambiente
    if (!apiKey || !apiSecret) {
        return res.status(500).json({ error: 'As variáveis de ambiente do Stream não foram configuradas.' });
    }

    try {
        // --- ESTA PARTE É CRUCIAL E PRECISA SER ADAPTADA ---
        // Aqui você deve colocar a lógica para identificar o usuário.
        // Como não temos uma sessão Java, você provavelmente passará um
        // token de autenticação do seu sistema no header da requisição.
        
        // Para fins de TESTE, vamos simular os dados.
        // DEPOIS que o chat funcionar, você DEVE substituir esta parte.
        const userId = "designer-123"; // Exemplo: Pegar o ID do usuário
        const userRole = "DESIGNER";    // Exemplo: Pegar o papel do usuário ("DESIGNER" ou "GRAFICA")
        // --- FIM DA PARTE DE ADAPTAÇÃO ---

        // Define o nome de exibição baseado no papel (a mágica do anonimato)
        const displayName = userRole === "DESIGNER" ? "Designer" : "Gráfica";

        // Inicializa o cliente do Stream
        const serverClient = StreamChat.getInstance(apiKey, apiSecret);
        
        // Cria/atualiza o usuário no Stream
        await serverClient.upsertUser({
            id: userId,
            name: displayName,
            role: userRole,
        });

        // Gera o token de acesso para este usuário
        const token = serverClient.createToken(userId);
        
        // Envia a resposta para o front-end
        res.status(200).json({ apiKey, token, userId });

    } catch (error) {
        console.error('Erro ao gerar token do chat:', error);
        res.status(500).json({ error: 'Não foi possível gerar o token do chat.' });
    }
};
// /api/sendMessage.js
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// IMPORTANTE: ID do usuário no Bitrix24 que aparecerá como autor das mensagens
// Pode ser um usuário "Sistema" ou o ID do próprio operador logado, se disponível
const OPERATOR_AUTHOR_ID = 1; // Usando ID 1 (Admin) como padrão

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        // sessionToken não é mais necessário para este fluxo específico
        const { dealId, message } = req.body;
        if (!dealId || !message) {
            return res.status(400).json({ message: 'ID do pedido e mensagem são obrigatórios.' });
        }

        // Não há mais validação de segurança aqui, pois a chamada é interna do painel de impressão.
        // A segurança está no acesso ao próprio painel.

        // Formata a mensagem para ser postada no Bitrix24
        // Identifica que a mensagem vem do Painel de Impressão
        const formattedComment = `[Mensagem do Painel de Impressão]\n--------------------\n${message}`;

        // Posta o comentário na timeline do negócio
        await axios.post(`${BITRIX24_API_URL}crm.timeline.comment.add`, {
            fields: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: 'deal',
                COMMENT: formattedComment,
                AUTHOR_ID: OPERATOR_AUTHOR_ID
            }
        });

        return res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
    }
};
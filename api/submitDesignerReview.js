// /api/submitDesignerReview.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Constantes dos campos para facilitar a manutenção
const FIELD_JA_AVALIADO = 'UF_CRM_1753383576795';
const FIELD_PONTUACAO = 'UF_USR_1744662446097'; // O campo que você encontrou!

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, dealId, avaliacao, comentario } = req.body;

        if (!sessionToken || !dealId || !avaliacao) {
            return res.status(400).json({ message: 'Dados insuficientes para a avaliação.' });
        }

        // 1. Obter o negócio para pegar o ID do designer e verificar se já foi avaliado
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        if (deal[FIELD_JA_AVALIADO] === true || deal[FIELD_JA_AVALIADO] === '1') {
            return res.status(409).json({ message: 'Este pedido já foi avaliado.' });
        }

        const designerId = deal.ASSIGNED_BY_ID;

        // 2. Obter o designer para pegar sua pontuação atual
        const designerResponse = await axios.post(`${BITRIX24_API_URL}user.get`, { ID: designerId });
        const designer = designerResponse.data.result[0];
        
        const pontuacaoAtual = parseInt(designer[FIELD_PONTUACAO] || '0', 10);
        const novaPontuacao = pontuacaoAtual + (avaliacao === 'positiva' ? 1 : -1);

        // 3. Montar um lote de comandos para executar tudo de uma vez (mais eficiente)
        const commands = {
            // Atualiza a pontuação do designer
            update_score: `user.update?ID=${designerId}&fields[${FIELD_PONTUACAO}]=${novaPontuacao}`,
            // Marca o negócio como avaliado
            mark_deal_reviewed: `crm.deal.update?id=${dealId}&fields[${FIELD_JA_AVALIADO}]=1`
        };

        // Adiciona o comentário ao histórico do negócio, se houver um
        if (comentario && comentario.trim() !== '') {
            const commentText = `**Avaliação do Cliente Recebida:**\n\nTipo: ${avaliacao === 'positiva' ? 'Positiva 👍' : 'Negativa 👎'}\n\nComentário: "${comentario.trim()}"`;
            commands.add_comment = `crm.timeline.comment.add?` + new URLSearchParams({
                fields: {
                    ENTITY_ID: dealId,
                    ENTITY_TYPE: 'deal',
                    COMMENT: commentText,
                    AUTHOR_ID: 1 // ID do Administrador/Sistema para ficar claro que é uma nota automática
                }
            });
        }
        
        // 4. Executar o lote de comandos
        await axios.post(`${BITRIX24_API_URL}batch`, { cmd: commands });

        return res.status(200).json({ message: 'Avaliação enviada com sucesso!' });

    } catch (error) {
        console.error('Erro ao submeter avaliação:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno ao processar sua avaliação.' });
    }
};
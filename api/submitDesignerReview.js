// /api/submitDesignerReview.js
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Constantes dos campos para facilitar a manutenção
const FIELD_JA_AVALIADO = 'UF_CRM_1753383576795';
const FIELD_PONTUACAO = 'UF_USR_1744662446097';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        console.log('[DEBUG] API /submitDesignerReview INICIADA.');
        const { sessionToken, dealId, avaliacao, comentario } = req.body;
        
        // --- LOG DE DEBUG ---
        console.log(`[DEBUG] Dados recebidos: dealId=${dealId}, avaliacao=${avaliacao}, temComentario=${!!comentario}`);

        if (!sessionToken || !dealId || !avaliacao) {
            return res.status(400).json({ message: 'Dados insuficientes para a avaliação.' });
        }
        
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }

        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, { id: dealId });
        const deal = dealResponse.data.result;

        if (!deal) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        
        if (deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para avaliar este pedido.' });
        }

        if (deal[FIELD_JA_AVALIADO] === true || deal[FIELD_JA_AVALIADO] === '1') {
            console.warn(`[AVISO] Tentativa de avaliar pedido já avaliado: ${dealId}`);
            return res.status(409).json({ message: 'Este pedido já foi avaliado.' });
        }

        const designerId = deal.ASSIGNED_BY_ID;
        // --- LOG DE DEBUG ---
        console.log(`[DEBUG] ID do Designer (ASSIGNED_BY_ID): ${designerId}`);
        if (!designerId) {
             throw new Error('O pedido não tem um designer responsável (ASSIGNED_BY_ID está vazio).');
        }

        const designerResponse = await axios.post(`${BITRIX24_API_URL}user.get`, { ID: designerId });
        const designer = designerResponse.data.result[0];
        
        const pontuacaoAtual = parseInt(designer[FIELD_PONTUACAO] || '0', 10);
        const novaPontuacao = pontuacaoAtual + (avaliacao === 'positiva' ? 1 : -1);
        
        // --- LOG DE DEBUG ---
        console.log(`[DEBUG] Pontuação do Designer: Atual=${pontuacaoAtual}, Nova=${novaPontuacao}`);

        const commands = {
            update_score: `user.update?ID=${designerId}&fields[${FIELD_PONTUACAO}]=${novaPontuacao}`,
            mark_deal_reviewed: `crm.deal.update?id=${dealId}&fields[${FIELD_JA_AVALIADO}]=1`
        };

        if (comentario && comentario.trim() !== '') {
            const commentText = `**Avaliação do Cliente Recebida:**\n\nTipo: ${avaliacao === 'positiva' ? 'Positiva 👍' : 'Negativa 👎'}\n\nComentário: "${comentario.trim()}"`;
            commands.add_comment = `crm.timeline.comment.add?` + new URLSearchParams({
                fields: {
                    ENTITY_ID: dealId,
                    ENTITY_TYPE: 'deal',
                    COMMENT: commentText,
                    AUTHOR_ID: 1 
                }
            });
            // --- LOG DE DEBUG ---
            console.log('[DEBUG] Comando de comentário foi adicionado ao lote.');
        } else {
            console.log('[DEBUG] Nenhum comentário fornecido, comando de comentário não será adicionado.');
        }
        
        // --- LOG DE DEBUG ---
        console.log('[DEBUG] COMANDOS ENVIADOS NO LOTE (BATCH):', JSON.stringify(commands, null, 2));
        
        const batchResponse = await axios.post(`${BITRIX24_API_URL}batch`, { cmd: commands });
        
        // --- LOG DE DEBUG CRÍTICO ---
        // Isso nos mostrará a resposta exata do Bitrix para cada comando dentro do lote.
        console.log('[DEBUG] RESPOSTA COMPLETA DO BATCH:', JSON.stringify(batchResponse.data, null, 2));

        // Verificação de erros na resposta do batch
        const batchResult = batchResponse.data.result;
        if (batchResult.result_error && Object.keys(batchResult.result_error).length > 0) {
            console.error('[ERRO CRÍTICO] O Bitrix retornou erros no lote:', batchResult.result_error);
            throw new Error('Um ou mais comandos falharam no Bitrix. Verifique os logs para detalhes.');
        }

        return res.status(200).json({ message: 'Avaliação enviada com sucesso!' });

    } catch (error) {
        console.error('Erro ao submeter avaliação:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro interno ao processar sua avaliação.' });
    }
};
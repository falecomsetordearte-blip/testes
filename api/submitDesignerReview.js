// /api/submitDesignerReview.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Constantes dos campos para facilitar a manutenção
const FIELD_JA_AVALIADO = 'UF_CRM_1753383576795';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, dealId, avaliacao, comentario } = req.body;

        if (!sessionToken || !dealId || !avaliacao) {
            return res.status(400).json({ message: 'Dados insuficientes para a avaliação.' });
        }
        
        // --- ETAPA 1: VALIDAÇÃO DE SEGURANÇA ---
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

        if (!deal) { return res.status(404).json({ message: 'Pedido não encontrado.' }); }
        if (deal.COMPANY_ID != user.COMPANY_ID) { return res.status(403).json({ message: 'Acesso negado a este pedido.' }); }
        if (deal[FIELD_JA_AVALIADO] === true || deal[FIELD_JA_AVALIADO] === '1') { return res.status(409).json({ message: 'Este pedido já foi avaliado.' }); }

        const designerId = deal.ASSIGNED_BY_ID;
        if (!designerId) { throw new Error('O pedido não tem um designer responsável (ASSIGNED_BY_ID está vazio).'); }

        // --- ETAPA 2: ATUALIZAR A PONTUAÇÃO NO NEON DB USANDO PRISMA ---
        // Usamos as operações atômicas 'increment' e 'decrement' do Prisma, que são seguras.
        await prisma.designerFinanceiro.update({
            where: { designer_id: designerId },
            data: {
                pontuacao: {
                    [avaliacao === 'positiva' ? 'increment' : 'decrement']: 1
                }
            }
        });

        // --- ETAPA 3: ATUALIZAR O BITRIX24 (COMENTÁRIO E STATUS DE AVALIADO) ---
        const commands = {
            mark_deal_reviewed: `crm.deal.update?id=${dealId}&fields[${FIELD_JA_AVALIADO}]=1`
        };

        if (comentario && comentario.trim() !== '') {
            const commentText = `**Avaliação do Cliente Recebida:**\n\nTipo: ${avaliacao === 'positiva' ? 'Positiva 👍' : 'Negativa 👎'}\n\nComentário: "${comentario.trim()}"`;
            commands.add_comment = `crm.timeline.comment.add?fields[ENTITY_ID]=${dealId}&fields[ENTITY_TYPE]=deal&fields[COMMENT]=${encodeURIComponent(commentText)}&fields[AUTHOR_ID]=1`;
        }
        
        await axios.post(`${BITRIX24_API_URL}batch`, { cmd: commands });

        return res.status(200).json({ message: 'Avaliação enviada com sucesso!' });

    } catch (error) {
        // Se ocorrer um erro, especialmente no Prisma, logamos para depuração.
        console.error('Erro ao submeter avaliação:', error);
        if (error.code === 'P2025') { // Código de erro do Prisma para "registro não encontrado"
            return res.status(404).json({ message: 'O registro financeiro para este designer não foi encontrado no banco de dados.' });
        }
        return res.status(500).json({ message: 'Ocorreu um erro interno ao processar sua avaliação.' });
    }
};
// /api/getDealDetails.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Adicionando a constante para o campo de avaliação
const FIELD_JA_AVALIADO = 'UF_CRM_1753383576795';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId } = req.body;
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Token e ID do pedido são obrigatórios.' });
        }

        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }
        
        // ETAPA 2: Buscar os dados do negócio, solicitando explicitamente os campos necessários
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, {
            id: dealId,
            select: [
                "*", // Pega todos os campos padrão
                "UF_*", // Pega todos os campos personalizados (UF_CRM_*)
                FIELD_JA_AVALIADO // Garante que nosso campo específico venha na resposta
            ]
        });
        const deal = dealResponse.data.result;

        if (!deal) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        if (deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado a este pedido.' });
        }

        // ETAPA 3: Buscar os dados do designer responsável
        const responsibleId = deal.ASSIGNED_BY_ID;
        let designerInfo = {
            nome: 'Setor de Arte',
            avatar: 'https://setordearte.com.br/images/logo-redonda.svg'
        };

        if (responsibleId) {
            const designerResponse = await axios.post(`${BITRIX24_API_URL}user.get.json`, {
                ID: responsibleId
            });
            const designer = designerResponse.data.result[0];

            if (designer) {
                designerInfo = {
                    nome: `${designer.NAME} ${designer.LAST_NAME}`.trim(),
                    avatar: designer.PERSONAL_PHOTO || designerInfo.avatar
                };
            }
        }
        
        // ETAPA 4: Buscar o histórico de mensagens
        const commentsResponse = await axios.post(`${BITRIX24_API_URL}crm.timeline.comment.list`, {
            filter: {
                ENTITY_ID: dealId,
                ENTITY_TYPE: "deal"
            },
            order: { "CREATED": "ASC" }
        });

        const historicoMensagens = (commentsResponse.data.result || []).map(comment => ({
            texto: comment.COMMENT,
            remetente: comment.AUTHOR_ID == 1 ? 'cliente' : 'designer'
        }));

        // ETAPA 5: Montar a resposta final
        return res.status(200).json({
            status: 'success',
            pedido: {
                ID: deal.ID,
                TITLE: deal.TITLE,
                STAGE_ID: deal.STAGE_ID,
                OPPORTUNITY: parseFloat(deal.OPPORTUNITY || 0) / 0.9,
                NOME_CLIENTE_FINAL: deal.UF_CRM_1741273407628,
                LINK_ATENDIMENTO: deal.UF_CRM_1752712769666,
                LINK_ARQUIVO_FINAL: deal.UF_CRM_1748277308731,
                designerInfo: designerInfo,
                historicoMensagens: historicoMensagens,
                // ADICIONADO: A chave que informa o frontend se o pedido já foi avaliado
                jaAvaliado: deal[FIELD_JA_AVALIADO] === true || deal[FIELD_JA_AVALIADO] === '1'
            }
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os detalhes do pedido.' });
    }
};
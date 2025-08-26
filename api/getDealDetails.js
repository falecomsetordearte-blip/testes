// /api/getDealDetails.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { sessionToken, dealId } = req.body;
        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Token e ID do pedido são obrigatórios.' });
        }

        // ETAPA 1: Validar o token de sessão e obter o COMPANY_ID
        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }
        
        // ETAPA 2: Buscar os dados do negócio (deal) específico
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, {
            id: dealId
        });
        const deal = dealResponse.data.result;

        // Validação de segurança: garantir que o negócio pertence à empresa do usuário
        if (!deal || deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado a este pedido.' });
        }
        // ETAPA 3: Buscar os dados do designer responsável (funcionário)
        let designerInfo = {
            nome: 'Setor de Arte',
            avatar: 'https://setordearte.com.br/images/logo-redonda.svg' // Fallback padrão
        };

        if (deal.RESPONSIBLE_ID) {
            const designerResponse = await axios.post(`${BITRIX24_API_URL}user.get.json`, {
                ID: deal.RESPONSIBLE_ID
            });
            const designer = designerResponse.data.result[0];

            if (designer) {
                designerInfo = {
                    nome: `${designer.NAME} ${designer.LAST_NAME}`.trim(),
                    avatar: designer.PERSONAL_PHOTO || designerInfo.avatar // Usa o avatar padrão se não houver foto
                };
            }
        }
        // ETAPA 3: Montar e enviar a resposta com os dados necessários
        return res.status(200).json({
            status: 'success',
            pedido: {
                ID: deal.ID,
                TITLE: deal.TITLE,
                STAGE_ID: deal.STAGE_ID,
                OPPORTUNITY: parseFloat(deal.OPPORTUNITY || 0) / 0.9, // Já envia o valor corrigido
                NOME_CLIENTE_FINAL: deal.UF_CRM_1741273407628, // Campo final 628
                LINK_ATENDIMENTO: deal.UF_CRM_1752712769666, // Campo final 666
                LINK_ARQUIVO_FINAL: deal.UF_CRM_1748277308731,
                designerInfo: designerInfo
            }
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os detalhes do pedido.' });
    }
};

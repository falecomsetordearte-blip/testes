// /api/getDealDetails.js - VERSÃO COM DEPURAÇÃO DO DESIGNER

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

        const userSearch = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        const user = userSearch.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida ou usuário não associado a uma empresa.' });
        }
        
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, {
            id: dealId,
            select: ["*", "UF_*"]
        });
        const deal = dealResponse.data.result;

        if (!deal || deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado a este pedido.' });
        }

        // --- INÍCIO DO BLOCO DE DEPURAÇÃO DO DESIGNER ---
        console.log(`[DEBUG] Buscando designer. ID do Responsável no Deal: ${deal.RESPONSIBLE_ID}`);

        let designerInfo = {
            nome: 'Setor de Arte',
            avatar: 'https://setordearte.com.br/images/logo-redonda.svg'
        };

        if (deal.RESPONSIBLE_ID) {
            try {
                console.log(`[DEBUG] Realizando chamada user.get para o ID: ${deal.RESPONSIBLE_ID}`);
                const designerResponse = await axios.post(`${BITRIX24_API_URL}user.get.json`, {
                    ID: deal.RESPONSIBLE_ID
                });
                
                console.log('[DEBUG] Resposta completa da API user.get:', designerResponse.data);
                const designer = designerResponse.data.result[0];

                if (designer) {
                    console.log('[DEBUG] Designer encontrado:', designer);
                    designerInfo = {
                        nome: `${designer.NAME} ${designer.LAST_NAME}`.trim(),
                        avatar: designer.PERSONAL_PHOTO || designerInfo.avatar
                    };
                } else {
                    console.warn('[AVISO] A API user.get retornou um resultado vazio. Usando fallback.');
                }
            } catch (userGetError) {
                console.error('[ERRO] A chamada para user.get falhou:', userGetError.response ? userGetError.response.data : userGetError.message);
                console.warn('[AVISO] Devido ao erro acima, usando fallback para "Setor de Arte".');
            }
        } else {
            console.warn('[AVISO] O campo RESPONSIBLE_ID do negócio está vazio ou nulo. Usando fallback.');
        }
        
        console.log('[DEBUG] Informações finais do designer que serão enviadas:', designerInfo);
        // --- FIM DO BLOCO DE DEPURAÇÃO DO DESIGNER ---
        
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
                designerInfo: designerInfo
            }
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os detalhes do pedido.' });
    }
};

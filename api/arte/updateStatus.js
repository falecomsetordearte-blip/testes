// /api/arte/updateStatus.js
const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const STAGE_IMPRESSAO = 'C17:UC_ZHMX6W'; // Destino quando aprovado
const FIELD_ARQUIVO_IMPRESSAO = 'UF_CRM_1748277308731'; // Campo Link Arquivo no Bitrix

module.exports = async (req, res) => {
    // Permite CORS para POST e OPTIONS (caso seu front precise)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        // Agora recebemos linkArquivo também
        const { sessionToken, dealId, action, linkArquivo } = req.body; 

        // 1. Auth
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['COMPANY_ID']
        });
        const user = userCheck.data.result ? userCheck.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(401).json({ message: 'Sessão inválida.' });

        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1`;
        if (!empresas.length) return res.status(403).json({ message: 'Empresa não encontrada.' });
        const empresaId = empresas[0].id;

        // 2. Lógica de Ações
        if (action === 'AJUSTES') {
            // Move card localmente para a coluna AJUSTES
            await prisma.$queryRaw`
                UPDATE painel_arte_cards 
                SET coluna = 'AJUSTES', updated_at = NOW()
                WHERE bitrix_deal_id = ${parseInt(dealId)} AND empresa_id = ${empresaId}
            `;
            return res.status(200).json({ success: true, message: 'Pedido movido para Ajustes.', movedToNextStage: false });
        } 
        
        else if (action === 'APROVADO') {
            // VALIDAÇÃO OBRIGATÓRIA: O link deve estar presente
            if (!linkArquivo || linkArquivo.trim() === '') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'É obrigatório informar o link do arquivo de impressão para aprovar.' 
                });
            }

            // Atualiza no Bitrix: Muda Fase E salva o Link
            await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
                id: dealId,
                fields: { 
                    'STAGE_ID': STAGE_IMPRESSAO,
                    [FIELD_ARQUIVO_IMPRESSAO]: linkArquivo // Atualiza o campo customizado
                }
            });

            // Remove do controle local (painel de arte), pois foi para impressão
            await prisma.$queryRaw`
                DELETE FROM painel_arte_cards 
                WHERE bitrix_deal_id = ${parseInt(dealId)} AND empresa_id = ${empresaId}
            `;

            return res.status(200).json({ success: true, message: 'Arte aprovada! Link salvo e enviado para impressão.', movedToNextStage: true });
        }

        return res.status(400).json({ message: 'Ação inválida.' });

    } catch (error) {
        console.error("Erro updateStatus:", error);
        return res.status(500).json({ message: 'Erro ao processar ação.' });
    }
};
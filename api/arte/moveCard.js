// /api/arte/moveCard.js
const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, dealId, novaColuna } = req.body;

        // 1. Auth
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['COMPANY_ID']
        });
        const user = userCheck.data.result ? userCheck.data.result[0] : null;
        if (!user || !user.COMPANY_ID) return res.status(401).json({ message: 'Sessão inválida.' });

        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1`;
        if (!empresas.length) return res.status(403).json({ message: 'Empresa não encontrada.' });
        const empresaId = empresas[0].id;

        // 2. Verificar se é Freelancer/Setor de Arte (Segurança Backend)
        // Buscamos o deal no Bitrix para ver o tipo de arte
        const dealCheck = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealCheck.data.result;
        
        if (deal) {
            const tipoArte = deal['UF_CRM_1761269158']; // Campo Tipo de Arte
            if (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer') {
                return res.status(403).json({ message: 'Pedidos com Freelancer não podem ser movidos manualmente.' });
            }
        }

        // 3. Atualizar Banco Local
        await prisma.$queryRaw`
            UPDATE painel_arte_cards 
            SET coluna = ${novaColuna}, updated_at = NOW()
            WHERE bitrix_deal_id = ${parseInt(dealId)} AND empresa_id = ${empresaId}
        `;

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro moveCard:", error);
        return res.status(500).json({ message: 'Erro ao mover card.' });
    }
};
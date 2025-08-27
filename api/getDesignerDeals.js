// /api/getDesignerDeals.js

const axios = require('axios');
const jwt = require('jsonwebtoken');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { token } = req.body;
        if (!token) {
            return res.status(401).json({ message: 'Token de sessão não fornecido.' });
        }

        // ETAPA 1: Verificar o token JWT para obter o ID do designer
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: 'Token de sessão inválido ou expirado.' });
        }
        
        const designerId = decoded.designerId;
        if (!designerId) {
            return res.status(401).json({ message: 'ID do designer não encontrado no token.' });
        }

        // ETAPA 2: Buscar os negócios (deals) atribuídos a este designer no Bitrix24
        const dealsResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: { 'ASSIGNED_BY_ID': designerId },
            order: { 'ID': 'DESC' },
            select: ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY']
        });

        const deals = dealsResponse.data.result || [];

        return res.status(200).json({ deals });

    } catch (error) {
        console.error('Erro ao buscar pedidos do designer:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar seus pedidos.' });
    }
};

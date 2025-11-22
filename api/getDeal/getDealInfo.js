// /api/getDeal/getDealInfo.js

const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Apenas aceita requisições GET
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        // Pega o ID do negócio da URL (ex: /api/getDeal/getDealInfo?dealId=123)
        const { dealId } = req.query;

        if (!dealId) {
            return res.status(400).json({ message: 'O parâmetro "dealId" é obrigatório.' });
        }

        console.log(`[getDealInfo] Buscando informações para o Deal ID: ${dealId}`);

        // Faz a chamada à API do Bitrix24 para obter os dados do negócio
        const dealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.get`, {
            id: dealId
        });

        const deal = dealResponse.data.result;

        // Verifica se o negócio foi encontrado
        if (!deal) {
            console.log(`[getDealInfo] Negócio com ID ${dealId} não encontrado.`);
            return res.status(404).json({ message: 'Negócio não encontrado.' });
        }

        console.log(`[getDealInfo] Informações do Deal ID ${dealId} encontradas com sucesso.`);
        
        // Retorna os dados completos do negócio em formato JSON
        return res.status(200).json({ deal });

    } catch (error) {
        console.error(`[getDealInfo] Erro ao buscar o negócio ${req.query.dealId}:`, error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar as informações do negócio.' });
    }
};
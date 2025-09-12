// /api/findField.js (Arquivo Temporário)
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    try {
        const response = await axios.get(`${BITRIX24_API_URL}user.fields.json`);
        // Filtra para encontrar o campo que tenha "PONTUAÇÃO" no nome
        const allFields = response.data.result;
        const pontuacaoField = Object.entries(allFields).find(([key, value]) => 
            value.EDIT_FORM_LABEL.toUpperCase().includes('PONTUA') || 
            value.LIST_COLUMN_LABEL.toUpperCase().includes('PONTUA')
        );

        if (pontuacaoField) {
            res.status(200).json({
                message: "Campo encontrado!",
                fieldId: pontuacaoField[0], // ex: "UF_CRM_123456"
                details: pontuacaoField[1]
            });
        } else {
            res.status(404).json({ message: "Campo de pontuação não encontrado. Verifique o nome do campo no Bitrix24." });
        }

    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar campos.', error: error.message });
    }
};
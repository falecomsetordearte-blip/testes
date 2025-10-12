// /testes/api/createProspecto.js

const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Mapeamento dos campos customizados para Prospectos
const FIELD_NOME_CLIENTE = 'UF_CRM_1741273407628';
const FIELD_WHATSAPP_CLIENTE = 'UF_CRM_1749481565243';

// --- COMO ENCONTRAR O STAGE_ID ---
// 1. Vá para o Bitrix24, na seção de CRM > Negócios.
// 2. Selecione o Pipeline 19.
// 3. Passe o mouse sobre o nome da primeira etapa (fase) do pipeline.
// 4. Olhe o link que aparece no canto inferior do navegador. Ele terá algo como "...stage_id=C19%3AXXXX".
// 5. O código que você precisa é "C19:XXXX". Troque o valor abaixo pelo seu.
const PIPELINE_ID = 19;
const STAGE_ID = 'C19:NEW'; // SUGESTÃO: Provavelmente é 'NEW'. Verifique conforme instrução acima!

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { nome, whatsapp } = req.body;

        if (!nome || !whatsapp) {
            return res.status(400).json({ message: 'Nome e WhatsApp são obrigatórios.' });
        }

        // Tratamento do WhatsApp: remove o '0' do início, se existir.
        let whatsappTratado = whatsapp;
        if (typeof whatsapp === 'string' && whatsapp.startsWith('0')) {
            whatsappTratado = whatsapp.substring(1);
        }

        const dealFields = {
            'TITLE': `Novo Prospecto CV - ${nome}`, // Título obrigatório para criar um negócio
            'CATEGORY_ID': PIPELINE_ID,
            'STAGE_ID': STAGE_ID,
            [FIELD_NOME_CLIENTE]: nome,
            [FIELD_WHATSAPP_CLIENTE]: whatsappTratado,
        };

        console.log("Enviando para o Bitrix24:", dealFields);

        // Criar o Negócio (Deal)
        const createDealResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: dealFields
        });

        const newDealId = createDealResponse.data.result;
        if (!newDealId) {
            console.error("Falha ao criar negócio. Resposta do Bitrix:", createDealResponse.data);
            throw new Error('Falha ao criar o negócio no Bitrix24.');
        }

        console.log(`Prospecto criado com sucesso. Deal ID: ${newDealId}`);
        return res.status(201).json({ success: true, dealId: newDealId });

    } catch (error) {
        console.error("--- ERRO AO CRIAR PROSPECTO ---");
        if (error.response) {
            console.error("Erro detalhado do Bitrix24:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Erro geral:", error.message);
        }
        return res.status(500).json({ message: 'Ocorreu um erro interno ao criar o prospecto.' });
    }
};
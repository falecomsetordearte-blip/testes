// /api/acabamento/concluirDeal.js

const axios = require('axios');
// A Vercel vai instalar isso sozinha se você adicionou no package.json
const { Pool } = require('pg'); 

// Conexão automática com o Banco Neon via Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// --- CONFIGURAÇÃO DE DESTINOS ---
const STAGE_EXTERNA = 'C17:UC_ZPMNF9'; // Instalação Externa
const STAGE_LOJA = 'C17:UC_EYLXD9';    // Instalação na Loja
const STAGE_PADRAO = 'C17:UC_GT7MVB';  // Outros

module.exports = async (req, res) => {
    // Cabeçalhos para evitar erros de permissão no navegador
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, dealId } = req.body;

        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        // 1. Validar usuário (Segurança)
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userCheck.data.result[0];
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // 2. Buscar Tipo de Entrega no Banco de Dados
        // Usamos a coluna 'bitrix_deal_id' conforme seu print
        const queryText = `SELECT tipo_entrega FROM pedidos WHERE bitrix_deal_id = $1 LIMIT 1`;
        const { rows } = await pool.query(queryText, [dealId]);

        let tipoEntrega = '';
        if (rows.length > 0 && rows[0].tipo_entrega) {
            tipoEntrega = rows[0].tipo_entrega.toUpperCase().trim();
        }

        // 3. Definir Destino
        let novoStageId = STAGE_PADRAO;

        if (tipoEntrega === 'INSTALAÇÃO EXTERNA') {
            novoStageId = STAGE_EXTERNA;
        } 
        // Adicionei também RETIRADA NO BALCÃO para ir para Loja, caso queira
        else if (tipoEntrega === 'INSTALAÇÃO NA LOJA' || tipoEntrega === 'RETIRADA NO BALCÃO') {
            novoStageId = STAGE_LOJA;
        }

        console.log(`Pedido ${dealId} (${tipoEntrega}) movido para ${novoStageId}`);

        // 4. Atualizar Bitrix
        await axios.post(`${BITRIX24_API_URL}crm.deal.update`, {
            id: dealId,
            fields: { 'STAGE_ID': novoStageId }
        });

        return res.status(200).json({ message: 'Concluído com sucesso!' });

    } catch (error) {
        console.error('Erro:', error);
        return res.status(500).json({ message: 'Erro ao processar.' });
    }
};
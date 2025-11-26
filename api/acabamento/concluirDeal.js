// /api/acabamento/concluirDeal.js

const axios = require('axios');
const { Pool } = require('pg'); 

// Conexão com o Banco de Dados (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// --- CONFIGURAÇÃO DOS DESTINOS (FASES) ---
const STAGE_EXTERNA = 'C17:UC_ZPMNF9';   // Instalação Externa
const STAGE_LOJA = 'C17:UC_EYLXD9';      // Instalação na Loja
const STAGE_FINALIZADO = 'C17:UC_IKPW6X'; // Qualquer outro (ex: Retirada)

module.exports = async (req, res) => {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, dealId } = req.body;

        if (!sessionToken || !dealId) {
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        // -----------------------------------------------------------
        // 1. SEGURANÇA: Validar Usuário e Empresa
        // -----------------------------------------------------------
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        const user = userCheck.data.result ? userCheck.data.result[0] : null;
        if (!user || !user.COMPANY_ID) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        // -----------------------------------------------------------
        // 2. SEGURANÇA: Verificar se o Pedido pertence à Empresa
        // -----------------------------------------------------------
        const dealCheck = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        const deal = dealCheck.data.result;

        if (!deal) return res.status(404).json({ message: 'Pedido não encontrado no Bitrix.' });
        
        // Comparação de ID da empresa (String vs Number)
        if (deal.COMPANY_ID != user.COMPANY_ID) {
            return res.status(403).json({ message: 'Acesso negado a este pedido.' });
        }

        // -----------------------------------------------------------
        // 3. REGRA DE NEGÓCIO: Buscar Tipo de Entrega no Banco
        // -----------------------------------------------------------
        const queryText = `SELECT tipo_entrega FROM pedidos WHERE bitrix_deal_id = $1 LIMIT 1`;
        
        // Convertemos dealId para inteiro para garantir compatibilidade com o banco
        const { rows } = await pool.query(queryText, [parseInt(dealId)]);

        let tipoEntrega = '';
        if (rows.length > 0 && rows[0].tipo_entrega) {
            tipoEntrega = rows[0].tipo_entrega.trim().toUpperCase();
        } else {
            // Se não achar no banco, tentamos pegar do Bitrix (fallback) 
            // Assumindo que o campo UF_CRM_1658492661 é o tipo de entrega no Bitrix
            tipoEntrega = (deal['UF_CRM_1658492661'] || '').toString().toUpperCase();
        }

        console.log(`[Acabamento] Deal ID: ${dealId} | Tipo: ${tipoEntrega}`);

        // -----------------------------------------------------------
        // 4. LÓGICA CONDICIONAL DE DESTINO
        // -----------------------------------------------------------
        let novoStageId = STAGE_FINALIZADO; // Padrão (C17:UC_IKPW6X) para "qualquer outro"

        if (tipoEntrega === 'INSTALAÇÃO EXTERNA') {
            novoStageId = STAGE_EXTERNA; // C17:UC_ZPMNF9
        } 
        else if (tipoEntrega === 'INSTALAÇÃO NA LOJA') {
            novoStageId = STAGE_LOJA;    // C17:UC_EYLXD9
        }
        // Se for 'RETIRADA', 'MOTOBOY' ou vazio, mantém o STAGE_FINALIZADO definido acima.

        // -----------------------------------------------------------
        // 5. ATUALIZAR BITRIX
        // -----------------------------------------------------------
        const updateResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.update.json`, {
            id: dealId,
            fields: { 'STAGE_ID': novoStageId }
        });

        if (updateResponse.data.result) {
            return res.status(200).json({ 
                success: true, 
                message: 'Fase atualizada com sucesso!',
                destino: novoStageId,
                tipoDetectado: tipoEntrega
            });
        } else {
            throw new Error('Bitrix não confirmou a atualização.');
        }

    } catch (error) {
        console.error('Erro ao concluir acabamento:', error);
        return res.status(500).json({ message: 'Erro interno ao processar.' });
    }
};
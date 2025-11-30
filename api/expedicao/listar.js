// api/expedicao/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

const FASES_ALVO = [
    'C17:UC_IKPW6X', // Finalizado/Entregue
    'C17:UC_WFTT1A', // Pago
    'C17:UC_G2024K'  // Devedor
];

module.exports = async (req, res) => {
    // CORS e Verificações Iniciais
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, query } = req.body;
        if (!sessionToken) return res.status(403).json({ message: 'Não autorizado' });

        // 1. Identificar Usuário e Empresa
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({ message: 'Sessão inválida' });
        const user = userCheck.data.result[0];
        
        // 2. Buscar IDs no Bitrix (Fonte da Verdade)
        let bitrixFilter = { 'COMPANY_ID': user.COMPANY_ID, 'STAGE_ID': FASES_ALVO };
        
        // Busca simples no Bitrix (opcional, foco é filtrar no banco local depois)
        if (query && !isNaN(parseInt(query))) bitrixFilter['ID'] = parseInt(query);

        const bitrixResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: bitrixFilter,
            select: ['ID', 'TITLE', 'STAGE_ID'], 
            order: { 'ID': 'DESC' },
            start: 0
        });

        const dealsBitrix = bitrixResponse.data.result || [];
        if (dealsBitrix.length === 0) return res.status(200).json([]);

        // 3. Cruzar com Banco Local usando bitrix_deal_id
        const dealIds = dealsBitrix.map(d => parseInt(d.ID));

        // SELECT usando os campos exatos dos seus prints
        const dadosLocais = await prisma.$queryRawUnsafe(
            `SELECT id, bitrix_deal_id, titulo, nome_cliente, whatsapp_cliente, briefing_completo, status_expedicao 
             FROM pedidos 
             WHERE bitrix_deal_id IN (${dealIds.join(',')})`
        );

        // 4. Mesclar
        const resultadoFinal = dealsBitrix.map(deal => {
            // Mágica: Encontra o registro local onde bitrix_deal_id é igual ao ID do Bitrix
            const local = dadosLocais.find(l => Number(l.bitrix_deal_id) === Number(deal.ID));

            return {
                id_bitrix: parseInt(deal.ID),
                // Se achou local, usa o ID serial local (importante para o 'entregar.js'), senão null
                id_interno: local ? local.id : null, 
                
                // Dados Visuais (Prioridade Local > Bitrix > Fallback)
                titulo: local?.titulo || deal.TITLE,
                nome_cliente: local?.nome_cliente || 'Cliente não sincronizado',
                whatsapp: local?.whatsapp_cliente || '-',
                briefing: local?.briefing_completo || 'Sem briefing registrado.',
                
                // Status
                status_expedicao: local?.status_expedicao || 'Aguardando Retirada'
            };
        });

        // Filtro de texto JS final (para garantir busca por nome/titulo local)
        let listaFiltrada = resultadoFinal;
        if (query && isNaN(parseInt(query))) {
            const q = query.toLowerCase();
            listaFiltrada = resultadoFinal.filter(item => 
                (item.nome_cliente && item.nome_cliente.toLowerCase().includes(q)) ||
                (item.titulo && item.titulo.toLowerCase().includes(q))
            );
        }

        return res.status(200).json(listaFiltrada);

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro ao listar dados.' });
    }
};
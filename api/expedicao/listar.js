// api/expedicao/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// Fases que você quer monitorar
const FASES_ALVO = [
    'C17:UC_IKPW6X', // Finalizado/Entregue
    'C17:UC_WFTT1A', // Pago
    'C17:UC_G2024K'  // Devedor
];

module.exports = async (req, res) => {
    // Headers Padrão
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, query } = req.body;
        if (!sessionToken) return res.status(403).json({ message: 'Não autorizado' });

        // -----------------------------------------------------------
        // 1. SEGURANÇA: Identificar Usuário e Empresa no Bitrix
        // -----------------------------------------------------------
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['ID', 'COMPANY_ID', 'NAME']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        const user = userCheck.data.result[0];
        
        // -----------------------------------------------------------
        // 2. BUSCAR NO BITRIX (A Fonte da Verdade)
        // -----------------------------------------------------------
        let bitrixFilter = {
            'COMPANY_ID': user.COMPANY_ID,
            'STAGE_ID': FASES_ALVO
        };

        if (query && query.trim().length > 0) {
            if (!isNaN(parseInt(query))) {
                bitrixFilter['ID'] = parseInt(query);
            } else {
                bitrixFilter['%TITLE'] = query.trim();
            }
        }

        const bitrixResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: bitrixFilter,
            select: ['ID', 'TITLE', 'OPPORTUNITY', 'CURRENCY_ID', 'STAGE_ID'],
            order: { 'ID': 'DESC' },
            start: 0
        });

        const dealsBitrix = bitrixResponse.data.result || [];

        if (dealsBitrix.length === 0) {
            return res.status(200).json([]);
        }

        // -----------------------------------------------------------
        // 3. CRUZAR COM BANCO LOCAL (CORRIGIDO)
        // -----------------------------------------------------------
        const dealIds = dealsBitrix.map(d => parseInt(d.ID));

        // MUDANÇA AQUI: Trocamos 'SELECT id, wpp_cliente...' por 'SELECT *'
        // Isso evita o erro se o nome da coluna for diferente.
        const dadosLocais = await prisma.$queryRawUnsafe(
            `SELECT * FROM pedidos WHERE id IN (${dealIds.join(',')})`
        );

        // -----------------------------------------------------------
        // 4. MESCLAR DADOS
        // -----------------------------------------------------------
        const resultadoFinal = dealsBitrix.map(deal => {
            const local = dadosLocais.find(l => Number(l.id) === Number(deal.ID));

            // Tenta encontrar o whatsapp em várias colunas possíveis
            const wpp = local?.wpp_cliente || local?.whatsapp || local?.telefone || local?.celular || '';
            
            // Tenta encontrar o nome do cliente
            const nome = local?.nome_cliente || local?.cliente || local?.nome || 'Cliente (Ver no Bitrix)';

            return {
                id: parseInt(deal.ID),
                titulo_automatico: local?.servico_tipo || deal.TITLE, 
                nome_cliente: nome,
                wpp_cliente: wpp,
                valor_orcamento: parseFloat(deal.OPPORTUNITY || 0),
                status_expedicao: local?.status_expedicao || 'Aguardando Retirada',
                fase_atual_bitrix: deal.STAGE_ID 
            };
        });

        // Filtro final de texto (caso Bitrix não tenha filtrado nome do cliente local)
        let listaFiltrada = resultadoFinal;
        if (query && isNaN(parseInt(query))) {
            const q = query.toLowerCase();
            listaFiltrada = resultadoFinal.filter(item => 
                (item.nome_cliente && item.nome_cliente.toLowerCase().includes(q)) ||
                (item.titulo_automatico && item.titulo_automatico.toLowerCase().includes(q))
            );
        }

        return res.status(200).json(listaFiltrada);

    } catch (error) {
        console.error("Erro Expedição Híbrida:", error);
        return res.status(500).json({ message: 'Erro ao sincronizar dados.' });
    }
};
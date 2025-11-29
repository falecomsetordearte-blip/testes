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
        // Montamos o filtro para pegar apenas deals da empresa e das fases certas
        let bitrixFilter = {
            'COMPANY_ID': user.COMPANY_ID, // SEGURANÇA MÁXIMA
            'STAGE_ID': FASES_ALVO
        };

        // Se tiver busca por texto, tentamos filtrar no Bitrix
        if (query && query.trim().length > 0) {
            // O Bitrix permite busca genérica usando "FIND" ou filtro específico por ID
            if (!isNaN(parseInt(query))) {
                bitrixFilter['ID'] = parseInt(query);
            } else {
                // Busca aproximada (Titulo ou Cliente) - Nota: Bitrix tem limitações em busca de texto
                // Para simplificar, usamos %LIKE% no titulo se suportado ou deixamos o filtro aberto
                // A melhor estratégia "Simples" é buscar os últimos 50 e filtrar o resto no JS se necessário
                // ou usar o SEARCH_CONTENT se configurado. Vamos tentar filtrar pelo TITLE.
                bitrixFilter['%TITLE'] = query.trim();
            }
        }

        const bitrixResponse = await axios.post(`${BITRIX24_API_URL}crm.deal.list.json`, {
            filter: bitrixFilter,
            select: ['ID', 'TITLE', 'OPPORTUNITY', 'CURRENCY_ID', 'STAGE_ID'], // Trazemos dados básicos
            order: { 'ID': 'DESC' },
            start: 0
        });

        const dealsBitrix = bitrixResponse.data.result || [];

        if (dealsBitrix.length === 0) {
            return res.status(200).json([]);
        }

        // -----------------------------------------------------------
        // 3. CRUZAR COM BANCO LOCAL (Para pegar o Status de Entrega)
        // -----------------------------------------------------------
        
        // Extraímos os IDs dos pedidos retornados pelo Bitrix
        const dealIds = dealsBitrix.map(d => parseInt(d.ID));

        // Buscamos no banco local APENAS esses IDs para saber o status
        // Também pegamos o nome do cliente salvo localmente para exibir bonito
        const dadosLocais = await prisma.$queryRawUnsafe(
            `SELECT id, nome_cliente, wpp_cliente, servico_tipo, status_expedicao 
             FROM pedidos 
             WHERE id IN (${dealIds.join(',')})`
        );

        // -----------------------------------------------------------
        // 4. MESCLAR DADOS (Bitrix + Local)
        // -----------------------------------------------------------
        const resultadoFinal = dealsBitrix.map(deal => {
            // Tenta achar os dados desse deal no banco local
            const local = dadosLocais.find(l => l.id == deal.ID);

            return {
                id: parseInt(deal.ID),
                // Prefere o dado local (que é formatado), senão usa o do Bitrix
                titulo_automatico: local?.servico_tipo || deal.TITLE, 
                nome_cliente: local?.nome_cliente || 'Cliente (Dados no Bitrix)',
                wpp_cliente: local?.wpp_cliente || '',
                valor_orcamento: parseFloat(deal.OPPORTUNITY || 0),
                // AQUI ESTÁ A MÁGICA: Se não tiver no banco local, é 'Aguardando Retirada'
                status_expedicao: local?.status_expedicao || 'Aguardando Retirada',
                // Info extra pra debug se precisar
                fase_atual_bitrix: deal.STAGE_ID 
            };
        });

        // Opcional: Filtro final de texto no JS para garantir (caso o filtro do Bitrix falhe em campos customizados)
        // Se já filtrou no Bitrix, isso é redundante, mas garante a busca por nome do cliente local
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
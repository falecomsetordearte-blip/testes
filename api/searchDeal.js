// /api/searchDeal.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Headers CORS para acesso do front-end
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, query } = req.body;
        if (!sessionToken) return res.status(401).json({ message: 'Sessão inválida.' });
        if (!query || query.trim().length === 0) return res.status(200).json({ results: [] });

        // 1. Identificar Empresa Logada usando o token
        let empresaId = null;
        
        // Verifica na tabela de painel_usuarios (nova infra)
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            // Fallback para a tabela empresas original
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) return res.status(401).json({ message: 'Sessão não autorizada.' });

        // 2. Preparar Filtros de Busca
        const termoLimpo = query.trim();
        const termoNumerico = query.replace(/\\D/g, ''); 
        
        // Busca de ID exato se a query conter apenas números e for do tamanho do que foi buscado
        const buscaId = termoNumerico.length === termoLimpo.length && termoLimpo.length > 0 ? parseInt(termoLimpo) : -1;
        
        // Match de parte do telefone ignorando os caracteres especiais ()- 
        const buscaTelefone = termoNumerico.length > 0 ? '%' + termoNumerico + '%' : '__nomatch__';
        
        // Texto generalizado (case-insensitive para LIKE)
        const buscaTexto = '%' + termoLimpo + '%';

        // 3. Buscar no CRM (Aba de CRM / Orçamentos / Novas Oportunidades)
        const crmResults = await prisma.$queryRawUnsafe(`
            SELECT 
                id, 
                titulo_automatico as titulo, 
                nome_cliente, 
                wpp_cliente as telefone, 
                coluna as etapa 
            FROM crm_oportunidades 
            WHERE empresa_id = $1 
            AND (
                id = $2 OR
                titulo_automatico ILIKE $3 OR
                nome_cliente ILIKE $3 OR 
                REGEXP_REPLACE(wpp_cliente, '\\D', '', 'g') ILIKE $4
            )
            LIMIT 15
        `, empresaId, buscaId, buscaTexto, buscaTelefone);

        // 4. Buscar na Fábrica (Pedidos em Produção)
        const pedidosResults = await prisma.$queryRawUnsafe(`
            SELECT 
                id, 
                titulo, 
                nome_cliente, 
                whatsapp_cliente as telefone, 
                etapa 
            FROM pedidos 
            WHERE empresa_id = $1 
            AND (
                id = $2 OR
                titulo ILIKE $3 OR
                nome_cliente ILIKE $3 OR 
                REGEXP_REPLACE(whatsapp_cliente, '\\D', '', 'g') ILIKE $4
            )
            LIMIT 15
        `, empresaId, buscaId, buscaTexto, buscaTelefone);

        // 5. Formatar Resultados para a interface Global (Spotlight)
        const results = [];

        // Adiciona CRM
        for (const crm of crmResults) {
            results.push({
                id: crm.id,
                titulo: crm.titulo || \`Oportunidade #\${crm.id}\`,
                nome_cliente: crm.nome_cliente,
                telefone: crm.telefone,
                cor_setor: '#3b82f6', // cor Azul escuro (CRM)
                setor: crm.etapa || 'CRM (Pré-Venda)', // Isso exibirá exatamente o quadro e a fase!
                modulo_destino: '/crm.html', // Roteia para o CRM
                data: null
            });
        }

        // Adiciona Fábrica (Produção e Etapas)
        for (const ped of pedidosResults) {
            let corSetor = '#64748b'; // default slate / cinza
            let moduloDestino = '/painel.html'; // Padrão
            const etapaStr = (ped.etapa || '').toUpperCase();

            // Roteamento Flexível e Cores Temáticas de acordo com o Kanban de Produção
            if (etapaStr.includes('ARTE')) {
                corSetor = '#8b5cf6'; // violeta
                moduloDestino = '/painel.html';
            } else if (etapaStr.includes('IMPRESS')) {
                corSetor = '#f59e0b'; // laranja
                moduloDestino = '/impressao/impressao.html';
            } else if (etapaStr.includes('ACABAMENTO')) {
                corSetor = '#ef4444'; // vermelho
                moduloDestino = '/acabamento/acabamento.html';
            } else if (etapaStr.includes('EXPEDI')) {
                corSetor = '#22c55e'; // verde
                moduloDestino = '/expedicao/index.html';
            } else if (etapaStr.includes('INSTALA')) {
                corSetor = '#ec4899'; // rosa
                moduloDestino = '/instalacao/painel.html';
            }

            results.push({
                id: ped.id,
                titulo: ped.titulo || \`Pedido #\${ped.id}\`,
                nome_cliente: ped.nome_cliente,
                telefone: ped.telefone,
                cor_setor: corSetor,
                setor: ped.etapa || 'Fábrica', // Isso indica a FASE exata! (Arte, Impressão, etc)
                modulo_destino: moduloDestino,
                data: null
            });
        }

        // Retorna Array Vazio ou Preenchido para o Frontend desenhar os badges
        return res.status(200).json({ results });

    } catch (error) {
        console.error("[GlobalSearch] Erro ao buscar pedidos locais:", error);
        return res.status(500).json({ message: 'Erro interno no banco de dados', results: [] });
    }
};
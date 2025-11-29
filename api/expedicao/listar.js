// api/expedicao/listar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    console.log(">>> [EXPEDIÇÃO] Iniciando busca...");

    try {
        const { sessionToken, query } = req.body;
        
        if (!sessionToken) {
            console.log(">>> [EXPEDIÇÃO] Erro: Token ausente.");
            return res.status(403).json({ message: 'Não autorizado' });
        }

        // --- DEFINIÇÃO DOS FILTROS ---
        const fasesPermitidas = "'C17:UC_IKPW6X', 'C17:UC_WFTT1A', 'C17:UC_G2024K'";

        // Filtro Base
        const filtroBase = `
            bitrix_stage_id IN (${fasesPermitidas}) 
            AND (status_expedicao IS NULL OR status_expedicao != 'Entregue')
        `;

        let sqlQuery;
        let params = [];

        if (query && query.trim().length > 0) {
            const termo = query.trim();
            const termoNumero = parseInt(termo); 
            const termoTexto = `%${termo}%`;

            console.log(`>>> [EXPEDIÇÃO] Filtrando por: ${termo}`);

            if (!isNaN(termoNumero)) {
                // Busca por ID
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE (${filtroBase})
                    AND (
                        id = $1 
                        OR nome_cliente ILIKE $2 
                        OR titulo_automatico ILIKE $2
                        OR wpp_cliente ILIKE $2
                    )
                    ORDER BY id DESC LIMIT 50
                `;
                params = [termoNumero, termoTexto];
            } else {
                // Busca por Texto
                sqlQuery = `
                    SELECT * FROM pedidos 
                    WHERE (${filtroBase})
                    AND (
                        nome_cliente ILIKE $1 
                        OR titulo_automatico ILIKE $1
                        OR wpp_cliente ILIKE $1
                        OR servico_tipo ILIKE $1
                    )
                    ORDER BY id DESC LIMIT 50
                `;
                params = [termoTexto];
            }
        } else {
            // Sem busca
            console.log(">>> [EXPEDIÇÃO] Listagem padrão (sem filtro de texto).");
            sqlQuery = `
                SELECT * FROM pedidos 
                WHERE ${filtroBase}
                ORDER BY id DESC LIMIT 50
            `;
        }

        console.log(">>> [EXPEDIÇÃO] Executando SQL:", sqlQuery);
        console.log(">>> [EXPEDIÇÃO] Params:", params);

        const pedidos = await prisma.$queryRawUnsafe(sqlQuery, ...params);
        
        console.log(`>>> [EXPEDIÇÃO] Resultados encontrados: ${pedidos.length}`);

        // DEBUG EXTRA: Se não achou nada, verifica quantos registros existem no total na tabela
        // para sabermos se a tabela está vazia ou se é o filtro de fase.
        if (pedidos.length === 0) {
            try {
                const total = await prisma.$queryRawUnsafe("SELECT count(*) as total FROM pedidos");
                const comFase = await prisma.$queryRawUnsafe("SELECT count(*) as total FROM pedidos WHERE bitrix_stage_id IS NOT NULL");
                console.log(">>> [DEBUG] Total na tabela 'pedidos':", total[0]?.total ? Number(total[0].total) : 0);
                console.log(">>> [DEBUG] Total com 'bitrix_stage_id' preenchido:", comFase[0]?.total ? Number(comFase[0].total) : 0);
                
                if (Number(comFase[0]?.total) === 0) {
                    console.log(">>> [ALERTA] A coluna 'bitrix_stage_id' parece estar vazia em todos os registros. O filtro vai bloquear tudo.");
                }
            } catch(e) { console.log("Erro no debug extra:", e.message); }
        }

        const pedidosFormatados = pedidos.map(p => ({
            ...p,
            id: Number(p.id),
            valor_orcamento: parseFloat(p.valor_orcamento || p.valor || 0), 
            status_expedicao: p.status_expedicao || 'Aguardando Retirada'
        }));

        return res.status(200).json(pedidosFormatados);

    } catch (error) {
        console.error(">>> [EXPEDIÇÃO ERROR]:", error);
        return res.status(500).json({ message: `Erro SQL: ${error.meta?.message || error.message}` });
    }
};
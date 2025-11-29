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

    try {
        const { sessionToken, query } = req.body;
        
        // Validação simples de sessão (pode ser aprimorada igual aos outros arqs)
        if (!sessionToken) return res.status(403).json({ message: 'Não autorizado' });

        // Filtro de Busca Precisa
        let whereClause = {
            // Filtra apenas pedidos que já passaram pelo financeiro ou produção, se desejar.
            // Por enquanto, trazemos tudo ou filtramos por status_expedicao
        };

        if (query && query.trim().length > 0) {
            const termo = query.trim();
            const termoNumero = parseInt(termo) || undefined;

            whereClause = {
                AND: [
                    {
                        OR: [
                            // Busca por ID (se for número)
                            ...(termoNumero ? [{ id: { equals: termoNumero } }] : []),
                            // Busca por Título (Case Insensitive)
                            { titulo_automatico: { contains: termo, mode: 'insensitive' } },
                            // Busca por Nome do Cliente
                            { nome_cliente: { contains: termo, mode: 'insensitive' } },
                            // Busca por Whatsapp
                            { wpp_cliente: { contains: termo } }
                        ]
                    }
                ]
            };
        }

        // Busca no Banco (Tabela crm_oportunidades ou pedidos)
        const pedidos = await prisma.crm_oportunidades.findMany({
            where: whereClause,
            orderBy: {
                updated_at: 'desc' // Mais recentes primeiro
            },
            take: 50 // Limite para não travar a tela se tiver milhoes
        });

        return res.status(200).json(pedidos);

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro ao buscar pedidos' });
    }
};
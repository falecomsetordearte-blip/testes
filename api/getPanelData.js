const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token: sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(400).json({ message: 'Token de sessão é obrigatório.' });
        }

        // 1. Identificar a Empresa pelo Token (busca segura com LIKE)
        let empresaId = null;
        let saldoDaEmpresa = 0;

        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, e.saldo 
            FROM painel_usuarios u
            JOIN empresas e ON u.empresa_id = e.id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if(users.length > 0) {
            empresaId = users[0].empresa_id;
            saldoDaEmpresa = parseFloat(users[0].saldo || 0);
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id, saldo FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
                saldoDaEmpresa = parseFloat(empresasLegacy[0].saldo || 0);
            }
        }

        if (!empresaId) {
            return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
        }

        // 2. Buscar os Pedidos dessa Empresa no Neon
        // Usamos o empresa_id para filtrar apenas os pedidos DESSE cliente
        const pedidosRaw = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, etapa, created_at
            FROM pedidos 
            WHERE empresa_id = $1
            ORDER BY id DESC
            LIMIT 20
        `, empresa.id);

        // 3. Formatar para o Frontend
        const pedidosFormatados = pedidosRaw.map(p => ({
            ID: p.id,
            TITLE: p.titulo || 'Pedido sem título',
            STAGE_ID: p.etapa || 'ATENDIMENTO', // Agora usamos a coluna etapa
            OPPORTUNITY: 0, // Como não temos a coluna valor no banco ainda, enviamos 0 para não quebrar
            COMMENTS: ''
        }));

        return res.status(200).json({
            status: 'success',
            saldo: saldoDaEmpresa,
            pedidos: pedidosFormatados
        });

    } catch (error) {
        console.error('Erro ao carregar painel:', error);
        return res.status(500).json({ message: 'Erro interno ao carregar dados.' });
    }
};
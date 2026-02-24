// api/arte/getBoardData.js - VERSÃO FILTRAGEM ESTRITA (SÓ 'ARTE')

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(403).json({ message: 'Token ausente' });

    try {
        // 1. Auth no Neon
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        const empresaId = empresas[0].id;

        // 2. Buscar Pedidos no Neon
        // CORREÇÃO: Agora filtramos EXATAMENTE pela etapa 'ARTE'.
        // Isso impede que 'ATENDIMENTO', 'ORÇAMENTO' ou qualquer outra coisa apareça aqui.
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT 
                p.*,
                d.nome as designer_nome
            FROM pedidos p
            LEFT JOIN designers_financeiro d ON p.designer_id = d.designer_id
            WHERE p.empresa_id = $1 
            AND p.etapa = 'ARTE' 
            ORDER BY p.created_at DESC
        `, empresaId);

        // 3. Formatar para o Frontend
        const deals = pedidos.map(p => {
            let coluna = 'NOVOS';

            // Lógica de Colunas
            if (p.designer_id) {
                // Se tem designer atribuído, vai para 'EM_ANDAMENTO'
                coluna = 'EM_ANDAMENTO';
            } else {
                // Se não tem designer, fica em 'NOVOS' esperando alguém pegar
                coluna = 'NOVOS';
            }

            // Campos mapeados para o frontend
            return {
                ID: p.id,
                TITLE: p.titulo,
                STAGE_ID: p.etapa, 
                coluna_local: coluna,
                UF_CRM_1761269158: p.tipo_arte || 'Setor de Arte',
                UF_CRM_1752712769666: p.link_acompanhar,
                UF_CRM_1764429361: null,
                UF_CRM_1727464924690: '', 
                UF_CRM_1741273407628: p.nome_cliente,
                UF_CRM_1738249371: p.briefing_completo,
                UF_CRM_1761123161542: p.servico,
                DESIGNER_NOME: p.designer_nome || null
            };
        });

        res.status(200).json({ deals });

    } catch (error) {
        console.error("Erro getBoardData:", error);
        res.status(500).json({ message: 'Erro interno ao carregar painel.' });
    }
};
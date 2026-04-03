const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, impressoraFilter } = req.body;

        let empresaId = null;
        if (sessionToken) {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (empresas.length > 0) empresaId = empresas[0].id;
            else {
                const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
                if (users.length > 0) empresaId = users[0].empresa_id;
            }
        }

        if (!empresaId) {
            return res.status(401).json({ message: 'Sessão inválida ou empresa não encontrada.' });
        }

        // 2. Buscar pedidos no banco local Neon (Postgres)
        const pedidos = await prisma.$queryRawUnsafe(`
            SELECT id, titulo, etapa, created_at, link_arquivo_impressao,
                   prazo_producao_minutos, impressoras_ids, link_acompanhar,
                   notificar_cliente, chatapp_chat_id
            FROM pedidos 
            WHERE empresa_id = $1 
            AND etapa IN ('IMPRESSÃO', 'ACABAMENTO')
            ORDER BY id DESC
        `, empresaId);

        let deals = pedidos.map(p => ({
            ID: p.id,
            TITLE: p.titulo || 'Sem Título',
            STAGE_ID: p.etapa,
            DATE_CREATE: p.created_at,
            'UF_CRM_1757466402085': p.prazo_producao_minutos || 1440, // Prazo em minutos
            'UF_CRM_1741349861326': p.link_acompanhar || '',
            'UF_CRM_1748277308731': p.link_arquivo_impressao || '',
            impressoras_ids: p.impressoras_ids || [],
            historicoMensagens: [] // Mensagens agora são gerenciadas via ChatApp ID se necessário
        }));

        // Filtro local de Impressora
        if (impressoraFilter && impressoraFilter !== 'cadastrar') {
            deals = deals.filter(deal => {
                return (deal.impressoras_ids || []).map(String).includes(String(impressoraFilter));
            });
        }

        return res.status(200).json({ deals });

    } catch (error) {
        console.error('Erro ao buscar negócios de produção:', error.response ? error.response.data : error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao buscar os dados.' });
    }
};
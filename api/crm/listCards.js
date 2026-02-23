const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Permite CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(401).json({ message: 'Token não fornecido' });

        // 1. Identificar a Empresa no Neon pelo Token
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas 
            WHERE session_tokens LIKE $1 
            LIMIT 1
        `, `%${sessionToken}%`);
        
        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida ou expirada.' });
        }
        
        const empresaId = empresas[0].id;

        // 2. Buscar os cards dessa empresa
        const cards = await prisma.$queryRawUnsafe(`
            SELECT * FROM crm_oportunidades 
            WHERE empresa_id = $1 
            ORDER BY posicao ASC, updated_at DESC
        `, empresaId);

        // Formata valores numéricos e JSON para o Frontend
        const cardsFormatados = cards.map(c => ({
            ...c,
            valor_orcamento: parseFloat(c.valor_orcamento),
            briefing_json: typeof c.briefing_json === 'string' ? JSON.parse(c.briefing_json) : c.briefing_json
        }));

        return res.status(200).json(cardsFormatados);

    } catch (error) {
        console.error("Erro listCards:", error);
        return res.status(500).json({ message: 'Erro interno ao listar cards.' });
    }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token: sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(401).json({ message: 'Token não fornecido.' });
        }

        // 1. Identificar a Empresa no Neon pelo Token de Sessão
        let empresaId = null;
        let pUserName = null;
        let empresa = null;

        // Tenta achar usuario novo
        const users = await prisma.$queryRawUnsafe(`
            SELECT u.empresa_id, u.nome, e.nome_fantasia, e.cnpj, e.whatsapp, e.email, e.responsavel, e.logo_id, e.saldo 
            FROM painel_usuarios u
            JOIN empresas e ON u.empresa_id = e.id
            WHERE u.session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
            pUserName = users[0].nome;
            empresa = users[0];
        } else {
            // Tenta logado antigo
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id, nome_fantasia, cnpj, whatsapp, email, responsavel, logo_id, saldo 
                FROM empresas 
                WHERE session_tokens LIKE $1 
                LIMIT 1
            `, `%${sessionToken}%`);

            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
                pUserName = empresasLegacy[0].responsavel || empresasLegacy[0].nome_fantasia;
                empresa = empresasLegacy[0];
            }
        }

        if (!empresa) {
            console.error("[getUserData] Token inválido ou não encontrado no Neon:", sessionToken);
            return res.status(403).json({ message: 'Sessão inválida ou expirada.' });
        }

        // Formatamos o retorno exatamente como o seu front-end espera
        return res.status(200).json({
            nome_fantasia: empresa.nome_fantasia,
            cnpj: empresa.cnpj,
            whatsapp: empresa.whatsapp,
            email: empresa.email,
            responsavel: empresa.responsavel,
            logo_id: empresa.logo_id,
            saldo: parseFloat(empresa.saldo || 0)
        });

    } catch (error) {
        console.error("Erro getUserData:", error);
        return res.status(500).json({ message: 'Erro interno ao carregar perfil.' });
    }
};
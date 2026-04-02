const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, nome_fantasia, whatsapp, responsavel, email, new_password, logo_url } = req.body;

        if (!token) {
            return res.status(401).json({ message: 'Token não fornecido.' });
        }

        // 1. Identificar a Empresa no Neon pelo Token de Sessão (Mesma lógica do getUserData.js)
        let empresaId = null;

        // Tenta achar em painel_usuarios primeiro (sistema novo)
        const users = await prisma.$queryRawUnsafe(
            `SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`,
            `%${token}%`
        );

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            // Tenta achar em empresas diretamente (legado)
            const empresasLegacy = await prisma.$queryRawUnsafe(
                `SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`,
                `%${token}%`
            );
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) {
            return res.status(403).json({ message: 'Sessão inválida ou expirada.' });
        }

        // 2. Preparar os dados para atualização
        const updateData = {
            nome_fantasia: nome_fantasia,
            whatsapp: whatsapp,
            responsavel: responsavel,
            email: email,
            atualizado_em: new Date()
        };

        // Se uma nova senha foi enviada, gerar hash e adicionar ao objeto
        if (new_password && new_password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            updateData.senha = await bcrypt.hash(new_password, salt);
        }

        // Se uma nova logo foi carregada no front (Vercel Blob), salvar a URL
        if (logo_url) {
            updateData.logo_id = logo_url;
        }

        // 3. Executar o Update no Neon usando Prisma
        await prisma.empresas.update({
            where: { id: empresaId },
            data: updateData
        });

        // 4. Se o usuário for do sistema novo (painel_usuarios), 
        // talvez queira atualizar o campo 'nome' lá também para manter coerência?
        // Vamos atualizar apenas se ele existir para esse token.
        if (users.length > 0) {
            await prisma.$executeRawUnsafe(
                `UPDATE painel_usuarios SET nome = $1 WHERE empresa_id = $2 AND session_tokens LIKE $3`,
                responsavel, empresaId, `%${token}%`
            );
        }

        return res.status(200).json({ success: true, message: 'Dados atualizados com sucesso.' });

    } catch (error) {
        console.error("Erro updateUserData:", error);
        return res.status(500).json({ message: 'Erro interno ao atualizar perfil.' });
    }
};
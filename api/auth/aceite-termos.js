// api/auth/aceite-termos.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    const { method } = req;
    const { token, type } = req.body; // type: 'DESIGNER' ou 'EMPRESA'

    if (!token || !type) {
        return res.status(400).json({ message: 'Dados incompletos (token ou tipo).' });
    }

    try {
        // 1. Identificar Usuário
        let userId = null;
        if (type === 'DESIGNER') {
            const designers = await prisma.$queryRawUnsafe(`
                SELECT designer_id FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${token}%`);
            if (designers.length > 0) userId = designers[0].designer_id;
        } else {
            const empresas = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${token}%`);
            if (empresas.length > 0) userId = empresas[0].id;
        }

        if (!userId) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        const action = req.body.action || 'check'; // Padrão é check se não informado

        // 2. Lógica por Ação
        if (action === 'check') {
            // Verificar se já aceitou a v1.0
            const aceites = await prisma.$queryRawUnsafe(`
                SELECT id FROM aceite_termos 
                WHERE usuario_id = $1 AND tipo_usuario = $2 AND versao = 'v1.0'
                LIMIT 1
            `, userId, type);

            return res.status(200).json({ 
                ja_aceitou: aceites.length > 0 
            });
        }

        if (action === 'save') {
            // Gravar Aceite
            await prisma.$executeRawUnsafe(`
                INSERT INTO aceite_termos (usuario_id, tipo_usuario, versao, aceito_em)
                VALUES ($1, $2, 'v1.0', NOW())
            `, userId, type);

            return res.status(200).json({ success: true, message: 'Termos aceitos com sucesso.' });
        }

        return res.status(405).json({ message: 'Método não permitido.' });

    } catch (error) {
        console.error("Erro API AceiteTermos:", error);
        return res.status(500).json({ message: 'Erro interno ao processar termos.' });
    }
};

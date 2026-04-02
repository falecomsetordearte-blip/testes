const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;

module.exports = async (req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        const { token, nome_fantasia, whatsapp, responsavel, email, new_password, logo_url } = req.body;

        if (!token) {
            return res.status(401).json({ message: 'Token não fornecido.' });
        }

        await client.connect();

        // 1. Identificar a Empresa no Neon pelo Token de Sessão (Mesma lógica do getUserData.js)
        let empresaId = null;
        let isSystemUser = false;

        // Tenta achar em painel_usuarios primeiro (sistema novo)
        const userCheck = await client.query(
            'SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1',
            [`%${token}%`]
        );

        if (userCheck.rows.length > 0) {
            empresaId = userCheck.rows[0].empresa_id;
            isSystemUser = true;
        } else {
            // Tenta achar em empresas diretamente (legado)
            const legacyCheck = await client.query(
                'SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1',
                [`%${token}%`]
            );
            if (legacyCheck.rows.length > 0) {
                empresaId = legacyCheck.rows[0].id;
            }
        }

        if (!empresaId) {
            return res.status(403).json({ message: 'Sessão inválida ou expirada.' });
        }

        // 2. Preparar a Query Dinâmica para atualização
        let updateFields = [
            "nome_fantasia = $1",
            "whatsapp = $2",
            "responsavel = $3",
            "email = $4",
            "atualizado_em = NOW()"
        ];
        let values = [nome_fantasia, whatsapp, responsavel, email];
        let paramCount = 5;

        // Se uma nova senha foi enviada, gerar hash e adicionar à query
        if (new_password && new_password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(new_password, salt);
            updateFields.push(`senha = $${paramCount}`);
            values.push(hashedPassword);
            paramCount++;
        }

        // Se uma nova logo foi carregada no front (Vercel Blob), salvar a URL
        if (logo_url) {
            updateFields.push(`logo_id = $${paramCount}`);
            values.push(logo_url);
            paramCount++;
        }

        // Adicionar o ID para o WHERE
        values.push(empresaId);
        const sqlUpdateEmpresas = `UPDATE empresas SET ${updateFields.join(', ')} WHERE id = $${values.length}`;
        
        await client.query(sqlUpdateEmpresas, values);

        // 3. Se o usuário for do sistema novo (painel_usuarios), atualizar o campo 'nome' lá também
        if (isSystemUser) {
            await client.query(
                'UPDATE painel_usuarios SET nome = $1 WHERE empresa_id = $2 AND session_tokens LIKE $3',
                [responsavel, empresaId, `%${token}%`]
            );
        }

        return res.status(200).json({ success: true, message: 'Dados atualizados com sucesso.' });

    } catch (error) {
        console.error("Erro updateUserData:", error);
        return res.status(500).json({ message: 'Erro interno ao atualizar perfil.' });
    } finally {
        await client.end();
    }
};
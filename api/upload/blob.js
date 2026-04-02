// /api/upload/blob.js
// Endpoint para upload de arquivos via Vercel Blob (client uploads - sem limite de tamanho)
const { handleUpload } = require('@vercel/blob/client');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const jsonBody = await handleUpload({
            body: req.body,
            request: req,
            token: process.env.BLOB_READ_WRITE_TOKEN,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                // Valida a sessão do usuário antes de permitir o upload
                let parsed = {};
                try { parsed = JSON.parse(clientPayload || '{}'); } catch (e) { }

                const sessionToken = parsed.sessionToken;
                if (sessionToken) {
                    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
                    try {
                        await client.connect();
                        const checkRes = await client.query(
                            'SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1',
                            [`%${sessionToken}%`]
                        );
                        if (checkRes.rows.length === 0) {
                            throw new Error('Sessão inválida.');
                        }
                    } finally {
                        await client.end();
                    }
                }

                return {
                    maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
                    tokenPayload: JSON.stringify({ sessionToken }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                console.log(`[Blob Upload] Concluído: ${blob.url} (${blob.pathname})`);
            },
        });

        return res.status(200).json(jsonBody);
    } catch (error) {
        console.error('[Blob Upload] Erro:', error.message);
        return res.status(400).json({ message: error.message || 'Erro no upload.' });
    }
};

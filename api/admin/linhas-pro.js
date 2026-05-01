// /api/admin/linhas-pro.js
// Gerenciamento das linhas WhatsApp PRO dos clientes
// GET  → lista todas as empresas com chatapp_plano = 'PREMIUM'
// POST → atualiza chatapp_license_id, chatapp_qr_link e chatapp_status de uma empresa

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ADMIN_PASS = process.env.ADMIN_PASS;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pass');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Autenticação
    const pass = req.headers['x-admin-pass'];
    if (pass !== ADMIN_PASS) {
        return res.status(401).json({ message: 'Não autorizado.' });
    }

    // ── GET: lista empresas PRO ────────────────────────────────────────────
    if (req.method === 'GET') {
        try {
            const empresas = await prisma.$queryRawUnsafe(`
                SELECT 
                    e.id,
                    e.nome_fantasia,
                    e.whatsapp,
                    e.email,
                    e.plan_type,
                    e.assinatura_status,
                    e.chatapp_plano,
                    e.chatapp_status,
                    e.chatapp_license_id,
                    e.chatapp_qr_link
                FROM empresas e
                WHERE e.chatapp_plano = 'PREMIUM'
                   OR e.plan_type = 'PRO'
                ORDER BY e.nome_fantasia ASC
            `);

            return res.status(200).json(empresas);
        } catch (err) {
            console.error('[LINHAS-PRO GET] Erro:', err.message);
            return res.status(500).json({ message: 'Erro ao buscar empresas.' });
        }
    }

    // ── POST: atualiza campos de uma empresa ──────────────────────────────
    if (req.method === 'POST') {
        try {
            const { empresaId, chatapp_license_id, chatapp_qr_link, chatapp_status } = req.body;

            if (!empresaId) {
                return res.status(400).json({ message: 'empresaId é obrigatório.' });
            }

            const statusValidos = ['AGUARDANDO_ADMIN', 'AGUARDANDO_QR', 'CONECTADO', 'INATIVO'];
            if (chatapp_status && !statusValidos.includes(chatapp_status)) {
                return res.status(400).json({ message: 'chatapp_status inválido.' });
            }

            await prisma.$executeRawUnsafe(`
                UPDATE empresas
                SET 
                    chatapp_license_id = $1,
                    chatapp_qr_link    = $2,
                    chatapp_status     = $3
                WHERE id = $4
            `,
                chatapp_license_id || null,
                chatapp_qr_link || null,
                chatapp_status || 'AGUARDANDO_ADMIN',
                Number(empresaId)
            );

            console.log(`[LINHAS-PRO POST] Empresa ${empresaId} atualizada. Status: ${chatapp_status}`);
            return res.status(200).json({ message: 'Linha atualizada com sucesso.' });

        } catch (err) {
            console.error('[LINHAS-PRO POST] Erro:', err.message);
            return res.status(500).json({ message: 'Erro ao atualizar empresa.' });
        }
    }

    return res.status(405).json({ message: 'Método não permitido.' });
};

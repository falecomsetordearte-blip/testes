// /api/asaas/status.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    console.log(`[POLLING STATUS] Requisição recebida. Método: ${req.method}`);

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, tipo } = req.body;
        if (!token || !tipo) {
            console.log(`[POLLING STATUS] Falha: Dados incompletos. Token: ${!!token}, Tipo: ${tipo}`);
            return res.status(400).json({ message: 'Dados incompletos.' });
        }

        let status = 'INATIVO';
        let planType = 'FREE';

        // CORREÇÃO APLICADA: Usando LIKE ao invés de = para encontrar o token salvo no banco
        const tokenBusca = `%${token}%`;
        console.log(`[POLLING STATUS] Buscando status para tipo: [${tipo}]. Token formatado: ${tokenBusca}`);

        if (tipo === 'empresa' || tipo === 'empresa_premium') {
            const rows = await prisma.$queryRawUnsafe(`SELECT assinatura_status, plan_type FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, tokenBusca);
            if (rows.length > 0) {
                status = rows[0].assinatura_status;
                planType = rows[0].plan_type || 'FREE';
                console.log(`[POLLING STATUS] Empresa encontrada. Status atual: ${status} | Plan Type: ${planType}`);
            } else {
                console.log(`[POLLING STATUS] Empresa não encontrada para este token.`);
            }
        } else {
            const rows = await prisma.$queryRawUnsafe(`SELECT assinatura_status, plan_type FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1`, tokenBusca);
            if (rows.length > 0) {
                status = rows[0].assinatura_status;
                planType = rows[0].plan_type || 'FREE';
                console.log(`[POLLING STATUS] Designer encontrado. Status atual: ${status} | Plan Type: ${planType}`);
            } else {
                console.log(`[POLLING STATUS] Designer não encontrado para este token.`);
            }
        }

        console.log(`[POLLING STATUS] Retornando para o frontend: status=${status || 'INATIVO'}, plan_type=${planType}`);
        return res.status(200).json({ status: status || 'INATIVO', plan_type: planType });

    } catch (error) {
        console.error(`[POLLING STATUS] ERRO:`, error.message);
        return res.status(500).json({ status: 'INATIVO', error: error.message });
    }
};
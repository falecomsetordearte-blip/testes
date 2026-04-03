// /api/trial-status.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const TRIAL_DAYS = 10;
const IMPLEMENTATION_DATE = new Date('2026-03-18T00:00:00Z');

module.exports = async (req, res) => {
    console.log('[TRIAL_CHECK] -> Iniciando verificação de acesso...');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { token, type } = req.body;
    console.log(`[TRIAL_CHECK] -> Payload recebido: tipo=${type}, token=${token ? 'Presente' : 'Ausente'}`);

    if (!token || !type) {
        return res.status(400).json({ message: 'Token e tipo são obrigatórios.' });
    }

    try {
        let usuario = null;

        // 1. Localização do Usuário
        if (type === 'DESIGNER' || type === 'designer') {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreta_super_segura');
                const dId = decoded.designerId || decoded.id;
                usuario = await prisma.designerFinanceiro.findUnique({
                    where: { designer_id: parseInt(dId) },
                    select: { criado_em: true, assinatura_status: true, nome: true, designer_id: true }
                });
                console.log(`[TRIAL_CHECK] -> Designer identificado via JWT: ${usuario?.nome} (ID: ${usuario?.designer_id})`);
            } catch (e) {
                console.log('[TRIAL_CHECK] -> JWT inválido, tentando busca por token bruto no banco...');
                const designers = await prisma.$queryRawUnsafe(`
                    SELECT criado_em, assinatura_status, nome, designer_id 
                    FROM designers_financeiro 
                    WHERE session_tokens = $1 OR session_tokens LIKE $2 LIMIT 1
                `, token, `%${token}%`);
                if (designers.length > 0) usuario = designers[0];
            }
        } else {
            // Lógica para Empresa
            const users = await prisma.$queryRawUnsafe(`
                SELECT e.criado_em, e.assinatura_status, u.nome 
                FROM painel_usuarios u
                JOIN empresas e ON u.empresa_id = e.id
                WHERE u.session_tokens LIKE $1 OR u.email = $2 LIMIT 1
            `, `%${token}%`, token);
            if (users.length > 0) usuario = users[0];
        }

        if (!usuario) {
            console.warn(`[TRIAL_CHECK] -> Usuário não localizado para o token.`);
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // 2. Verificação de Assinatura (Aceita ACTIVE e ATIVO)
        const statusbanco = (usuario.assinatura_status || '').toUpperCase();
        console.log(`[TRIAL_CHECK] -> Status atual no banco de dados: "${statusbanco}"`);

        // Lista de status que liberam o acesso total (pagos)
        const statusAprovados = ['ACTIVE', 'ATIVO', 'CONFIRMED', 'PAGO', 'ASSINADO'];

        if (statusAprovados.includes(statusbanco)) {
            console.log(`[TRIAL_CHECK] -> ACESSO LIBERADO: Assinatura detectada como ${statusbanco}`);
            return res.status(200).json({
                is_trial: false,
                is_active: true,
                dias_restantes: 0,
                status_atual: statusbanco
            });
        }

        // 3. Cálculo do Trial (Se for INATIVO ou pendente)
        console.log('[TRIAL_CHECK] -> Sem assinatura paga. Calculando dias de Trial...');
        const dataCriacao = usuario.criado_em ? new Date(usuario.criado_em) : IMPLEMENTATION_DATE;
        const dataInicioTrial = dataCriacao < IMPLEMENTATION_DATE ? IMPLEMENTATION_DATE : dataCriacao;

        const agora = new Date();
        const diffTempo = agora - dataInicioTrial;
        const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
        const diasRestantes = TRIAL_DAYS - diffDias;

        const trialAindaValido = diasRestantes > 0;
        console.log(`[TRIAL_CHECK] -> Resultado: Dias de uso: ${diffDias} | Dias restantes: ${diasRestantes} | Trial válido: ${trialAindaValido}`);

        return res.status(200).json({
            is_trial: true,
            is_active: trialAindaValido,
            dias_restantes: trialAindaValido ? diasRestantes : 0,
            expirado: !trialAindaValido,
            status_atual: statusbanco
        });

    } catch (error) {
        console.error('[TRIAL_CHECK] -> Erro crítico na verificação:', error);
        // Em caso de erro, permitimos o acesso para não bloquear o usuário por falha técnica
        return res.status(200).json({ is_active: true, is_trial: true, dias_restantes: 1 });
    }
};
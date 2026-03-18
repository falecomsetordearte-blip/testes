const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const TRIAL_DAYS = 13;
const IMPLEMENTATION_DATE = new Date('2026-03-18T00:00:00Z');

module.exports = async (req, res) => {
    // Config de CORS para chamadas locais
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { token, type } = req.body;
    console.log(`[TrialCheck] Recebido: type=${type}, token=${token ? 'fornecido' : 'ausente'}`);

    if (!token || !type) {
        return res.status(400).json({ message: 'Token e tipo são obrigatórios.' });
    }

    try {
        let usuario = null;

        // 1. Extração do Usuário (Designer ou Empresa)
        if (type === 'DESIGNER') {
            // Tenta JWT
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dafe076daebb92f73ec9ffaa7d07db15082ee12d46ddaf8afdfb4fabe7dd0105');
                const dId = decoded.designerId || decoded.id;
                usuario = await prisma.designerFinanceiro.findUnique({
                    where: { designer_id: parseInt(dId) },
                    select: { criado_em: true, assinatura_status: true }
                });
            } catch (e) {
                // Fallback busca direta por token string
                const designers = await prisma.$queryRawUnsafe(`
                    SELECT criado_em, assinatura_status 
                    FROM designers_financeiro 
                    WHERE session_tokens = $1 OR session_tokens LIKE $2 LIMIT 1
                `, token, `%${token}%`);
                if (designers.length > 0) usuario = designers[0];
            }
        } else {
            // Empresa (Vários locais possíveis)
            const users = await prisma.$queryRawUnsafe(`
                SELECT e.criado_em, e.assinatura_status 
                FROM painel_usuarios u
                JOIN empresas e ON u.empresa_id = e.id
                WHERE u.session_tokens LIKE $1 OR u.email = $2 LIMIT 1
            `, `%${token}%`, token);

            if (users.length > 0) {
                usuario = users[0];
            } else {
                // Tenta na tabela empresas direto (legacy)
                const legs = await prisma.$queryRawUnsafe(`
                    SELECT criado_em, assinatura_status FROM empresas 
                    WHERE session_tokens LIKE $1 LIMIT 1
                `, `%${token}%`);
                if (legs.length > 0) usuario = legs[0];
            }
        }

        if (!usuario) {
            console.warn(`[TrialCheck] Usuário não localizado para o token informado.`);
            // Para não quebrar o front, retornamos um status padrão de trial se o token existir mas não achar no banco (pode ser delay de sync)
            return res.status(200).json({
                is_trial: true,
                is_active: true,
                dias_restantes: TRIAL_DAYS,
                expirado: false
            });
        }

        // 2. Verificação de Assinatura
        const status = (usuario.assinatura_status || '').toUpperCase();
        console.log(`[TrialCheck] Status encontrado: ${status}`);

        if (['ACTIVE', 'CONFIRMED', 'PAGO', 'ASSINADO'].includes(status)) {
            return res.status(200).json({ 
                is_trial: false, 
                is_active: true,
                dias_restantes: 0 
            });
        }

        // 3. Cálculo considerando a data de ativação do sistema (Upgrade para todos)
        const dataCriacao = usuario.criado_em ? new Date(usuario.criado_em) : IMPLEMENTATION_DATE;
        const dataInicioTrial = dataCriacao < IMPLEMENTATION_DATE ? IMPLEMENTATION_DATE : dataCriacao;
        
        const agora = new Date();
        const diffTempo = agora - dataInicioTrial;
        const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
        const diasRestantes = TRIAL_DAYS - diffDias;

        console.log(`[TrialCheck] Dias restantes: ${diasRestantes}`);

        return res.status(200).json({
            is_trial: true,
            is_active: diasRestantes > 0,
            dias_restantes: diasRestantes > 0 ? diasRestantes : 0,
            expirado: diasRestantes <= 0
        });

    } catch (error) {
        console.error('[TrialCheck] Erro fatal:', error);
        return res.status(200).json({ // Retornamos trial em caso de erro para não bloquear o usuário injustamente
            is_trial: true,
            is_active: true,
            dias_restantes: TRIAL_DAYS,
            expirado: false
        });
    }
};

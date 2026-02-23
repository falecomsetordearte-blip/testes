const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { 
            sessionToken, id, nome_cliente, wpp_cliente, servico_tipo, 
            arte_origem, valor_orcamento, valor_pago, valor_restante, 
            briefing_json, titulo_manual 
        } = req.body;

        // 1. Identificar a Empresa no Neon
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida.' });
        const empresaId = empresas[0].id;

        // 2. Gestão do Cliente (Cria se não existir na tabela crm_clientes)
        const clienteExistente = await prisma.$queryRawUnsafe(`
            SELECT id FROM crm_clientes WHERE empresa_id = $1 AND whatsapp = $2 LIMIT 1
        `, empresaId, wpp_cliente);
        
        if (clienteExistente.length === 0) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at) 
                VALUES ($1, $2, $3, NOW())
            `, empresaId, nome_cliente, wpp_cliente);
        }

        const vOrcamento = parseFloat(valor_orcamento || 0);
        const vPago = parseFloat(valor_pago || 0);
        const vRestante = parseFloat(valor_restante || 0);

        // 3. Salvar (Update) ou Criar (Insert)
        if (id) {
            // --- ATUALIZAÇÃO ---
            let queryUpdate = `
                UPDATE crm_oportunidades
                SET nome_cliente = $1, wpp_cliente = $2, servico_tipo = $3, 
                    arte_origem = $4, valor_orcamento = $5, valor_pago = $6,
                    valor_restante = $7, briefing_json = $8::jsonb, updated_at = NOW()
            `;
            
            const params = [nome_cliente, wpp_cliente, servico_tipo, arte_origem, vOrcamento, vPago, vRestante, briefing_json];

            if (titulo_manual && titulo_manual.trim() !== '') {
                queryUpdate += `, titulo_automatico = $9 `;
                params.push(titulo_manual);
            }

            queryUpdate += ` WHERE id = $${params.length + 1} AND empresa_id = $${params.length + 2}`;
            params.push(parseInt(id), empresaId);

            await prisma.$executeRawUnsafe(queryUpdate, ...params);
            
            return res.status(200).json({ success: true });

        } else {
            // --- CRIAÇÃO ---
            const novoCard = await prisma.$queryRawUnsafe(`
                INSERT INTO crm_oportunidades (
                    empresa_id, nome_cliente, wpp_cliente, servico_tipo, 
                    arte_origem, valor_orcamento, valor_pago, valor_restante,
                    briefing_json, coluna, posicao, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'Novos', 0, NOW())
                RETURNING id
            `, empresaId, nome_cliente, wpp_cliente, servico_tipo, arte_origem, vOrcamento, vPago, vRestante, briefing_json);
            
            const newId = novoCard[0].id;

            // Gera título automático se não tiver manual
            const tituloFinal = (titulo_manual && titulo_manual.trim() !== '') ? titulo_manual : `#${1000 + newId}`;

            await prisma.$executeRawUnsafe(`
                UPDATE crm_oportunidades SET titulo_automatico = $1 WHERE id = $2
            `, tituloFinal, newId);
            
            return res.status(200).json({ success: true, id: newId, titulo: tituloFinal });
        }

    } catch (error) {
        console.error(`[API saveCard Error]:`, error);
        return res.status(500).json({ message: 'Erro ao salvar oportunidade.' });
    }
};
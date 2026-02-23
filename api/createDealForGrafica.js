// /api/createDealForGrafica.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Headers de segurança e CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { 
            sessionToken, 
            arte, 
            supervisaoWpp, 
            valorDesigner, 
            tipoEntrega, 
            linkArquivo, 
            cdrVersao,     
            formato,       
            ...formData 
        } = req.body;

        if (!sessionToken) return res.status(403).json({ message: 'Sessão inválida.' });

        // 1. Identificar Usuário e Empresa direto no Neon
        // Usamos LIKE para verificar se o token existe na lista de tokens
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT * FROM empresas 
            WHERE session_tokens LIKE $1 
            LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Empresa não identificada ou sessão expirada.' });
        }

        const empresa = empresas[0];
        const custoDesigner = parseFloat(valorDesigner || 0);

        // 2. Validar Saldo (Apenas para Setor de Arte)
        if (arte === 'Setor de Arte') {
            const saldoAtual = parseFloat(empresa.saldo || 0);
            if (saldoAtual < custoDesigner) {
                return res.status(400).json({ 
                    success: false,
                    message: `Saldo insuficiente. Necessário: R$ ${custoDesigner.toFixed(2)}. Saldo atual: R$ ${saldoAtual.toFixed(2)}` 
                });
            }
        }

        // 3. Preparar Briefing
        let briefingFinal = formData.briefingFormatado || '';
        briefingFinal += `\n\n=== DETALHES TÉCNICOS ===`;
        if (formato) briefingFinal += `\nFormato: ${formato}`;
        if (cdrVersao) briefingFinal += `\nVersão Corel: ${cdrVersao}`;
        if (tipoEntrega) briefingFinal += `\nEntrega: ${tipoEntrega ? tipoEntrega.toUpperCase() : 'NÃO INFORMADO'}`;
        if (linkArquivo) briefingFinal += `\nLink Arquivo: ${linkArquivo}`;

        // 4. Inserir Pedido no Neon (SQL PURO)
        // Definimos a etapa inicial como 'ATENDIMENTO' (ou 'NOVOS')
        // Usamos RETURNING id para pegar o ID que acabou de ser criado
        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (
                empresa_id, 
                titulo, 
                nome_cliente, 
                whatsapp_cliente, 
                servico, 
                tipo_arte, 
                tipo_entrega, 
                valor_designer, 
                briefing_completo, 
                etapa,
                created_at,
                bitrix_deal_id 
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ATENDIMENTO', NOW(), 'SISTEMA')
            RETURNING id
        `, 
        empresa.id, 
        formData.titulo || 'Pedido sem título', 
        formData.nomeCliente || 'Cliente', 
        formData.wppCliente || '', 
        formData.servico || '', 
        arte || '', 
        tipoEntrega || '', 
        custoDesigner, 
        briefingFinal
        );

        const newPedidoId = insertResult[0].id; // Pega o ID gerado (ex: 3590)

        // 5. Financeiro: Descontar Saldo e Registrar Histórico
        if (arte === 'Setor de Arte' && custoDesigner > 0) {
            // Atualiza saldo
            await prisma.$executeRawUnsafe(`
                UPDATE empresas 
                SET saldo = saldo - $1, 
                    saldo_devedor = COALESCE(saldo_devedor, 0) + $1 
                WHERE id = $2
            `, custoDesigner, empresa.id);

            // Grava histórico
            await prisma.$executeRawUnsafe(`
                INSERT INTO historico_financeiro (
                    empresa_id, valor, tipo, deal_id, titulo, data
                ) 
                VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
            `, empresa.id, custoDesigner, String(newPedidoId), `Produção: ${formData.titulo || 'Novo Pedido'}`);
        }

        // 6. Atualizar Painel Kanban (Cards)
        // Se você usa a tabela painel_arte_cards para aquele kanban de arrastar
        await prisma.$executeRawUnsafe(`
            INSERT INTO painel_arte_cards (
                empresa_id, bitrix_deal_id, coluna, posicao, updated_at
            ) 
            VALUES ($1, $2, 'NOVOS', 0, NOW())
        `, empresa.id, newPedidoId); // Note: Estamos salvando o ID do Neon na coluna bitrix_deal_id por enquanto para não quebrar o front

        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        console.error('Erro ao criar Pedido:', error);
        return res.status(500).json({ message: 'Erro interno ao criar pedido.' });
    }
};
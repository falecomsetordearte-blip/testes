// /api/createDealForGrafica.js - COM ROTEAMENTO INTELIGENTE

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { 
            sessionToken, arte, supervisaoWpp, valorDesigner, 
            tipoEntrega, linkArquivo, cdrVersao, formato, ...formData 
        } = req.body;

        if (!sessionToken) return res.status(403).json({ message: 'Sessão inválida.' });

        const empresas = await prisma.$queryRawUnsafe(`
            SELECT * FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Empresa não identificada.' });
        const empresa = empresas[0];
        const custoDesigner = parseFloat(valorDesigner || 0);

        // --- LÓGICA DE ROTEAMENTO (MÁGICA AQUI) ---
        let etapaDestino = 'ARTE'; // Padrão para Designer Próprio e Setor de Arte
        
        if (arte === 'Arquivo do Cliente') {
            etapaDestino = 'IMPRESSÃO'; // Pula a arte se o arquivo já estiver pronto
        }
        // ------------------------------------------

        let briefingFinal = formData.briefingFormatado || '';
        briefingFinal += `\n\n=== DETALHES TÉCNICOS ===`;
        if (formato) briefingFinal += `\nFormato: ${formato}`;
        if (cdrVersao) briefingFinal += `\nVersão Corel: ${cdrVersao}`;
        if (tipoEntrega) briefingFinal += `\nEntrega: ${tipoEntrega.toUpperCase()}`;
        if (linkArquivo) briefingFinal += `\nLink Arquivo: ${linkArquivo}`;

        const insertResult = await prisma.$queryRawUnsafe(`
            INSERT INTO pedidos (
                empresa_id, titulo, nome_cliente, whatsapp_cliente, 
                servico, tipo_arte, tipo_entrega, valor_designer, 
                briefing_completo, etapa, created_at, bitrix_deal_id 
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 0)
            RETURNING id
        `, 
        empresa.id, formData.titulo, formData.nomeCliente, formData.wppCliente, 
        formData.servico, arte, tipoEntrega, custoDesigner, briefingFinal, etapaDestino
        );

        const newPedidoId = insertResult[0].id;

        // Financeiro
        if (arte === 'Setor de Arte' && custoDesigner > 0) {
            await prisma.$executeRawUnsafe(`
                UPDATE empresas SET saldo = saldo - $1, saldo_devedor = COALESCE(saldo_devedor, 0) + $1 WHERE id = $2
            `, custoDesigner, empresa.id);
            await prisma.$executeRawUnsafe(`
                INSERT INTO historico_financeiro (empresa_id, valor, tipo, deal_id, titulo, data) 
                VALUES ($1, $2, 'SAIDA', $3, $4, NOW())
            `, empresa.id, custoDesigner, String(newPedidoId), `Produção: ${formData.titulo}`);
        }

        return res.status(200).json({ success: true, dealId: newPedidoId });

    } catch (error) {
        return res.status(500).json({ message: 'Erro: ' + error.message });
    }
};
// /api/products/saveProduct.js
const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Headers padrões
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, product } = req.body;

        // 1. Auth Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({message: 'Auth Error'});
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        
        // 2. Pega Empresa Local
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1`;
        if (!empresas.length) return res.status(404).json({message: 'Empresa não encontrada'});
        const empresaId = empresas[0].id;

        // 3. Montar dados para o Prisma
        // O frontend vai mandar um JSON complexo, vamos estruturar para o Prisma create/update
        const dadosProduto = {
            empresa_id: empresaId,
            nome: product.nome,
            prazo_producao: product.prazo,
            tipo_calculo: product.tipo_calculo, // UNIDADE, METRO, FIXO, FAIXA
            preco_base: parseFloat(product.preco_base || 0),
            largura_padrao: product.largura ? parseFloat(product.largura) : null,
            altura_padrao: product.altura ? parseFloat(product.altura) : null,
            
            // Nested Writes (Cria variações e opções junto)
            variacoes: {
                create: product.variacoes.map(v => ({
                    nome: v.nome,
                    tipo_selecao: v.tipo_selecao || 'UNICA',
                    opcoes: {
                        create: v.opcoes.map(op => ({
                            nome: op.nome,
                            preco_adicional: parseFloat(op.preco_adicional || 0)
                        }))
                    }
                }))
            },
            
            faixas_preco: {
                create: product.faixas.map(f => ({
                    minimo: parseInt(f.minimo),
                    maximo: f.maximo ? parseInt(f.maximo) : null,
                    valor_unitario: parseFloat(f.valor)
                }))
            }
        };

        let result;

        if (product.id) {
            // ATUALIZAÇÃO (Modo simples: deleta variações antigas e recria - mais fácil de gerenciar neste estágio)
            // Primeiro deleta relações
            await prisma.produtoVariacao.deleteMany({ where: { produto_id: parseInt(product.id) } });
            await prisma.produtoPrecoFaixa.deleteMany({ where: { produto_id: parseInt(product.id) } });

            // Atualiza produto e recria relações
            result = await prisma.produto.update({
                where: { id: parseInt(product.id) },
                data: dadosProduto
            });
        } else {
            // CRIAÇÃO
            result = await prisma.produto.create({ data: dadosProduto });
        }

        return res.status(200).json({ success: true, id: result.id });

    } catch (error) {
        console.error("Erro saveProduct:", error);
        return res.status(500).json({ message: error.message });
    }
};
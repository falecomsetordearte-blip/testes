const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

// ID do campo customizado para a data de emissão
const FIELD_DATA_EMISSAO = 'UF_CRM_1760392935167';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });
        
        const { valor, dataEmissao } = req.body; 
        
        if (!valor || isNaN(valor) || Number(valor) <= 0) {
            return res.status(400).json({ message: 'Valor de saque inválido.' });
        }
        if (!dataEmissao) {
            return res.status(400).json({ message: 'A Data de Emissão da NF é obrigatória.' });
        }
        const valorSaque = new Decimal(valor);

        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);
        const designerInfo = JSON.parse(req.headers['x-designer-info'] || '{}');
        const designerName = designerInfo.name || 'Designer';

        const financeiro = await prisma.designerFinanceiro.findUnique({
            where: { designer_id: designerId },
        });

        if (!financeiro || financeiro.saldo_disponivel.lt(valorSaque)) {
            return res.status(402).json({ message: 'Saldo insuficiente.' });
        }
        
        // <<< INÍCIO DA ALTERAÇÃO >>>
        // Nova regra: Valida se o dia da semana é sexta-feira no fuso horário de Brasília.
        const hoje = new Date();
        const options = { timeZone: 'America/Sao_Paulo', weekday: 'long' };
        // Usamos 'en-US' para obter o nome do dia em inglês ("Friday"), o que simplifica a comparação.
        const diaDaSemanaEmBrasilia = new Intl.DateTimeFormat('en-US', options).format(hoje);

        if (diaDaSemanaEmBrasilia !== 'Friday') {
            return res.status(403).json({ message: 'Saques são permitidos apenas às sextas-feiras.' });
        }

        /*
            // Bloco de código antigo removido:
            if (financeiro.ultimo_saque_em) {
                const seteDiasAtras = new Date();
                seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
                if (new Date(financeiro.ultimo_saque_em) > seteDiasAtras) {
                    return res.status(429).json({ message: 'Você só pode solicitar um saque a cada 7 dias.' });
                }
            }
        */
        // <<< FIM DA ALTERAÇÃO >>>

        await prisma.designerFinanceiro.update({
            where: { designer_id: designerId },
            data: {
                saldo_disponivel: { decrement: valorSaque },
                saldo_pendente: { increment: valorSaque },
                ultimo_saque_em: new Date(), // Continuamos atualizando a data do último saque para registro
            },
        });
        
        await axios.post(`${BITRIX24_API_URL}crm.deal.add.json`, {
            fields: {
                'TITLE': `Solicitação de Saque - ${designerName}`,
                'OPPORTUNITY': valor,
                'CATEGORY_ID': 31,
                'ASSIGNED_BY_ID': designerId,
                'UF_CRM_1760392935167': dataEmissao, // Enviando a data para o Bitrix24
            }
        });

        res.status(200).json({ success: true, message: 'Solicitação de saque enviada com sucesso!' });
    } catch (error) {
        console.error("Erro ao solicitar saque:", error);
        res.status(500).json({ message: 'Erro ao processar a solicitação.' });
    }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const sessionToken = req.body.sessionToken;

        let empresaId = null;
        if (sessionToken) {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (empresas.length > 0) empresaId = empresas[0].id;
            else {
                const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
                if (users.length > 0) empresaId = users[0].empresa_id;
            }
        }

        // MATERIAIS PADRÃO (Previamente vindos do Bitrix, agora 100% locais)
        const materialOptions = [
            { id: '101', value: 'Adesivo Brilho' },
            { id: '102', value: 'Adesivo Fosco' },
            { id: '103', value: 'Adesivo Perfurado' },
            { id: '104', value: 'Lona 440g' },
            { id: '105', value: 'Lona 280g' },
            { id: '106', value: 'Banner' },
            { id: '107', value: 'Placa PS' },
            { id: '108', value: 'Backdrop' },
            { id: '109', value: 'Papel Fotográfico' },
            { id: '110', value: 'Vinil de Recorte' }
        ];

        const tipoEntregaOptions = [
            { id: '201', value: 'Retirada no Balcão' },
            { id: '202', value: 'Entrega / Motoboy' },
            { id: '203', value: 'Instalação Loja' },
            { id: '204', value: 'Instalação Externa' }
        ];

        let impressorasLocais = [];
        if (empresaId) {
            impressorasLocais = await prisma.$queryRawUnsafe(`
                SELECT id, nome as value FROM impressoras 
                WHERE empresa_id = $1 AND ativo = true ORDER BY nome ASC
            `, empresaId);
        }

        const filters = {
            impressoras: impressorasLocais,
            materiais: materialOptions,
            tiposEntrega: tipoEntregaOptions
        };
        
        return res.status(200).json(filters);

    } catch (error) {
        console.error('[getProductionFilters] Erro ao buscar opções de filtros:', error.message);
        return res.status(500).json({ message: 'Ocorreu um erro ao carregar os filtros.' });
    }
};
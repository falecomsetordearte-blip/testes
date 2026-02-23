module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Filtros manuais para não depender do Bitrix bloqueado
    const filters = {
        impressoras: [
            { id: '1', value: 'BANNER 3.20' },
            { id: '2', value: 'ADESIVO 1.60' },
            { id: '3', value: 'UV RÍGIDOS' },
            { id: '4', value: 'RECORTE' }
        ],
        materiais: [
            { id: '10', value: 'Lona 440g' },
            { id: '11', value: 'Adesivo Transparente' },
            { id: '12', value: 'PVC 2mm' }
        ]
    };

    return res.status(200).json(filters);
};
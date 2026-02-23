// /api/getProductionFilters.js
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Lista de exemplo baseada no que costuma ter em gráficas
    const filters = {
        impressoras: [
            { id: '1', value: 'ECOSOLVENTE 01' },
            { id: '2', value: 'ECOSOLVENTE 02' },
            { id: '3', value: 'UV PLANA' },
            { id: '4', value: 'RECORTE ELETRÔNICO' }
        ],
        materiais: [
            { id: '10', value: 'Lona 440g' },
            { id: '11', value: 'Adesivo Brilho' },
            { id: '12', value: 'Adesivo Fosco' },
            { id: '13', value: 'PVC 2mm' }
        ]
    };

    return res.status(200).json(filters);
};
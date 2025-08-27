// /api/webhooks/processarPagamentoDesigner.js - VERSÃO DE DEPURAÇÃO

module.exports = async (req, res) => {
    console.log("--- [WEBHOOK BITRIX24] Nova requisição recebida ---");
    
    console.log("CABEÇALHOS (HEADERS):");
    console.log(JSON.stringify(req.headers, null, 2));

    console.log("CORPO DA REQUISIÇÃO (BODY):");
    console.log(JSON.stringify(req.body, null, 2));

    console.log("--- FIM DA DEPURAÇÃO ---");

    // Responde 200 OK para o Bitrix24 não pausar a automação
    res.status(200).send("OK");
};

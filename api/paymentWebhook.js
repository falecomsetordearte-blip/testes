// /api/paymentWebhook.js - CÓDIGO DE DIAGNÓSTICO DE HEADERS

module.exports = async (req, res) => {
    console.log("--- INICIANDO DIAGNÓSTICO DE HEADERS DO WEBHOOK ---");

    // Imprime todos os cabeçalhos recebidos em um formato fácil de ler
    console.log("CABEÇALHOS RECEBIDOS (HEADERS):");
    console.log(JSON.stringify(req.headers, null, 2));

    console.log("--- FIM DO DIAGNÓSTICO ---");

    // Responde ao Asaas para que ele não fique tentando de novo
    return res.status(200).send('Diagnóstico concluído. Verifique os logs do servidor.');
};

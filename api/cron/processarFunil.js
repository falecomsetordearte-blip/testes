const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { enviarMensagemTexto, formatarTelefone } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    // Esta rota deve ser protegida ou chamada por um segredo de CRON
    // Para fins de desenvolvimento, vamos permitir a execução manual via POST
    
    console.log("[CRON-MARKETING] Iniciando processamento do funil...");

    try {
        // 1. Buscar todas as empresas que têm mensagens de marketing ativas
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT empresa_id FROM marketing_mensagens WHERE ativo = true
        `);

        let disparosRealizados = 0;

        for (const emp of empresas) {
            const empresaId = emp.empresa_id;

            // 2. Buscar todas as mensagens ativas dessa empresa, ordenadas
            const mensagens = await prisma.$queryRawUnsafe(`
                SELECT * FROM marketing_mensagens 
                WHERE empresa_id = $1 AND ativo = true 
                ORDER BY ordem ASC, criado_em ASC
            `, empresaId);

            if (mensagens.length === 0) continue;

            // 3. Buscar todos os clientes da empresa
            const clientes = await prisma.$queryRawUnsafe(`
                SELECT * FROM marketing_clientes WHERE empresa_id = $1
            `, empresaId);

            for (const cliente of clientes) {
                // 4. Buscar segmentos do cliente
                const segmentosClienteRows = await prisma.$queryRawUnsafe(`
                    SELECT segmento_id FROM marketing_cliente_segmentos WHERE cliente_id = $1
                `, cliente.id);
                const segmentosClienteIds = segmentosClienteRows.map(s => s.segmento_id);

                // 5. Buscar log do último disparo para este cliente
                const logs = await prisma.$queryRawUnsafe(`
                    SELECT m.ordem, l.enviado_em, l.mensagem_id
                    FROM marketing_cliente_funil_log l
                    JOIN marketing_mensagens m ON l.mensagem_id = m.id
                    WHERE l.cliente_id = $1 AND l.empresa_id = $2
                    ORDER BY m.ordem DESC, l.enviado_em DESC
                    LIMIT 1
                `, cliente.id, empresaId);

                let proximaMensagem = null;

                if (logs.length === 0) {
                    // Nunca recebeu nada, a primeira mensagem é a candidata
                    proximaMensagem = mensagens[0];
                } else {
                    const ultimaOrdem = logs[0].ordem;
                    // Busca a primeira mensagem que tenha ordem maior que a última enviada
                    proximaMensagem = mensagens.find(m => m.ordem > ultimaOrdem);
                }

                if (!proximaMensagem) continue; // Funil finalizado para este cliente

                // 6. Verificar se o cliente tem a tag necessária (se houver restrição)
                let segmentosAlvo = proximaMensagem.segmentos_alvo;
                if (typeof segmentosAlvo === 'string') segmentosAlvo = JSON.parse(segmentosAlvo);

                const deveReceber = !segmentosAlvo || 
                                   segmentosAlvo.length === 0 || 
                                   segmentosAlvo.some(id => segmentosClienteIds.includes(Number(id)));

                if (!deveReceber) {
                    // Pular esta mensagem e marcar como "processada" no log para não travar o funil?
                    // Na verdade, se ele não deve receber ESSA, ele deve pular para a próxima?
                    // Vamos apenas registrar um log "pulado" ou simplesmente ignorar e o cron tentará a próxima na próxima rodada?
                    // Melhor: Registrar no log que essa mensagem foi ignorada por falta de tag para ele poder seguir para a próxima.
                    await prisma.$queryRawUnsafe(`
                        INSERT INTO marketing_cliente_funil_log (empresa_id, cliente_id, mensagem_id, enviado_em)
                        VALUES ($1, $2, $3, NOW())
                    `, empresaId, cliente.id, proximaMensagem.id);
                    continue; 
                }

                // 7. Verificar Delay (Tempo de Espera)
                const dataReferencia = logs.length > 0 ? new Date(logs[0].enviado_em) : new Date(cliente.criado_em);
                const agora = new Date();
                const diffHoras = Math.floor((agora - dataReferencia) / (1000 * 60 * 60));

                if (diffHoras >= proximaMensagem.delay_horas) {
                    // 8. DISPARAR!
                    const chatId = formatarTelefone(cliente.whatsapp);
                    if (chatId) {
                        console.log(`[CRON-MARKETING] Enviando mensagem ${proximaMensagem.id} para cliente ${cliente.nome} (${cliente.whatsapp})`);
                        
                        await enviarMensagemTexto(chatId.toString(), proximaMensagem.texto);
                        
                        // Registrar no log
                        await prisma.$queryRawUnsafe(`
                            INSERT INTO marketing_cliente_funil_log (empresa_id, cliente_id, mensagem_id, enviado_em)
                            VALUES ($1, $2, $3, NOW())
                        `, empresaId, cliente.id, proximaMensagem.id);
                        
                        disparosRealizados++;
                    }
                }
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: `Processamento concluído. ${disparosRealizados} mensagens enviadas.` 
        });

    } catch (error) {
        console.error("Erro no Cron de Marketing:", error);
        return res.status(500).json({ message: 'Erro ao processar funil de marketing.' });
    }
};

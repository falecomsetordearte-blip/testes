// Usamos uma função anônima auto-executável para isolar nosso código
// e evitar conflitos com outros scripts, como o 'script.js'.
(function() {
    // NÍVEL 1: GARANTIR QUE O CÓDIGO RODE APENAS QUANDO O DOM ESTIVER PRONTO
    document.addEventListener('DOMContentLoaded', () => {
        
        // Bloco de segurança para capturar qualquer erro que possa ocorrer aqui dentro
        // e não deixar que ele pare a página inteira.
        try {
            console.log("[INFO] DOM carregado. Iniciando script de detalhe do pedido.");

            // --- CONSTANTES E VARIÁVEIS GLOBAIS ---
            const DETALHE_PEDIDO_WEBHOOK_URL = 'https://hook.us2.make.com/yme8pjo46n92nq8dobetm29z2nf8ne3g';
            const ENVIAR_MENSAGEM_WEBHOOK_URL = 'https://hook.us2.make.com/9lgcr82buk35gayapff3wscrgobblxqp';
            const CANCELAR_PEDIDO_WEBHOOK_URL = 'https://hook.us2.make.com/hc707sf1ddsg85lm3efir8okq5gvbb7h';
            const ADICIONAR_CREDITOS_WEBHOOK_URL = 'https://hook.us2.make.com/5p9m8o8p6hhglqlmxkj5sc7t2ztr8yic';
            const MARCAR_VERIFICADO_WEBHOOK_URL = 'https://hook.us2.make.com/az3upink2wm1vd6xs5qslm0mbyj2ucv8';
            const AVALIACAO_DESIGNER_WEBHOOK_URL = 'https://hook.us2.make.com/rya2wuxg35f6q2rdtkjeu1rjyi16xmox';
            const FRONTEND_API_KEY = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFiZWYxYTUxLWMwNGQtNDJlZC05M2I5LTFmMDI5ZGNjY2Y5MDo6JGFhY2hfMjM0NzUxMjItYjlkNi00NzRmLWI4YWEtOGI2NmNhZGNkMTUy';

            const sessionToken = localStorage.getItem('sessionToken'  );
            const userName = localStorage.getItem('userName');
            const urlParams = new URLSearchParams(window.location.search);
            const pedidoId = urlParams.get('id');
            let statusAtualDoPedido = null;
            let tipoAvaliacaoAtual = null;
            let responsibleIdAtual = null;

            // --- ELEMENTOS DO DOM ---
            const detalhesWrapper = document.getElementById("detalhes-wrapper");
            const btnVerAtendimento = document.getElementById("btn-ver-atendimento");
            const formMensagem = document.getElementById('form-mensagem');
            const inputMensagem = document.getElementById('input-mensagem');
            const btnEnviar = document.getElementById('btn-enviar-mensagem');
            const mensagensContainer = document.getElementById('mensagens-container');
            const btnCancelar = document.getElementById("btn-cancelar");
            const btnAdicionarCredito = document.getElementById("btn-adicionar-credito");
            const modalAdquirirCreditos = document.getElementById("modal-adquirir-creditos");
            const closeModals = document.querySelectorAll(".close-modal");
            const adquirirCreditosForm = document.getElementById("adquirir-creditos-form");
            const creditosValorInput = document.getElementById("creditos-valor");
            const creditosFormError = document.getElementById("creditos-form-error");
            const btnMarcarVerificado = document.getElementById("btn-marcar-verificado");
            const feedbackModal = document.getElementById("feedback-modal");
            const feedbackClose = document.getElementById("feedback-close");
            const feedbackCancel = document.getElementById("feedback-cancel");
            const feedbackForm = document.getElementById("feedback-form");
            const feedbackText = document.getElementById("feedback-text");
            const dontShowAgain = document.getElementById("dont-show-again");
            const feedbackTypeIndicator = document.getElementById("feedback-type-indicator");
            const feedbackTypeIcon = document.getElementById("feedback-type-icon");
            const feedbackTypeText = document.getElementById("feedback-type-text");
            const btnLike = document.querySelector('.btn-like');
            const btnDislike = document.querySelector('.btn-dislike');

            // --- VERIFICAÇÃO DE LOGIN E ID DO PEDIDO ---
            if (!sessionToken) {
                window.location.href = 'login';
                return;
            }
            if (!pedidoId) {
                document.body.innerHTML = '<h1>Erro: ID do pedido não fornecido.</h1>';
                return;
            }
            
            // --- INICIALIZAÇÃO DA PÁGINA ---
            document.getElementById('user-greeting').textContent = `Olá, ${userName}!`;
            document.getElementById('logout-button').addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login';
            });

            // --- FUNÇÃO PARA ENVIAR AVALIAÇÃO DO DESIGNER ---
            async function enviarAvaliacaoDesigner(feedback, comentario = '') {
                try {
                    console.log(`[INFO] Enviando avaliação do designer: feedback=${feedback}, comentario="${comentario}"`);
                    
                    const response = await fetch(AVALIACAO_DESIGNER_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-make-apikey': FRONTEND_API_KEY 
                        },
                        body: JSON.stringify({ 
                            token: sessionToken,
                            dealId: pedidoId,
                            feedback: feedback,
                            comentario: comentario
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    console.log('[SUCESSO] Avaliação enviada com sucesso:', data);
                    
                    // Fechar modal após envio bem-sucedido
                    if (feedbackModal) {
                        feedbackModal.style.display = 'none';
                    }
                    
                } catch (error) {
                    console.error('[ERRO] Falha ao enviar avaliação do designer:', error);
                }
            }

            // --- FUNÇÃO PARA ABRIR MODAL DE FEEDBACK ---
            function abrirModalFeedback(tipoAvaliacao) {
                if (!feedbackModal) {
                    console.error('[ERRO] Modal de feedback não encontrado');
                    return;
                }

                tipoAvaliacaoAtual = tipoAvaliacao;
                
                // Configurar indicador visual do tipo de avaliação
                if (feedbackTypeIcon && feedbackTypeText) {
                    if (tipoAvaliacao === 1) {
                        feedbackTypeIcon.textContent = '👍';
                        feedbackTypeText.textContent = 'Avaliação Positiva';
                        feedbackTypeIndicator.style.color = '#27ae60';
                    } else {
                        feedbackTypeIcon.textContent = '👎';
                        feedbackTypeText.textContent = 'Avaliação Negativa';
                        feedbackTypeIndicator.style.color = '#e74c3c';
                    }
                }
                
                // Limpar campo de texto
                if (feedbackText) {
                    feedbackText.value = '';
                }
                
                // Desmarcar checkbox
                if (dontShowAgain) {
                    dontShowAgain.checked = false;
                }
                
                // Mostrar modal
                feedbackModal.style.display = 'flex';
            }

            // --- EVENT LISTENERS PARA BOTÕES DE AVALIAÇÃO ---
            if (btnLike) {
                btnLike.addEventListener('click', () => {
                    console.log('[INFO] Botão Like clicado');
                    abrirModalFeedback(1);
                });
            }

            if (btnDislike) {
                btnDislike.addEventListener('click', () => {
                    console.log('[INFO] Botão Dislike clicado');
                    abrirModalFeedback(0);
                });
            }

            // --- EVENT LISTENERS PARA MODAL DE FEEDBACK ---
            if (feedbackClose) {
                feedbackClose.addEventListener('click', () => {
                    feedbackModal.style.display = 'none';
                });
            }

            if (feedbackCancel) {
                feedbackCancel.addEventListener('click', () => {
                    feedbackModal.style.display = 'none';
                });
            }

            // Fechar modal ao clicar fora dele
            if (feedbackModal) {
                feedbackModal.addEventListener('click', (e) => {
                    if (e.target === feedbackModal) {
                        feedbackModal.style.display = 'none';
                    }
                });
            }
            // --- EVENT LISTENER PARA O FORMULÁRIO DE MENSAGEM ---
            if (formMensagem) {
                formMensagem.addEventListener('submit', async (e) => {
                    // 1. Impede que o formulário recarregue a página
                    e.preventDefault();

                    // 2. Pega a mensagem do campo de texto
                    const mensagem = inputMensagem.value.trim();
                    if (!mensagem) return; // Não envia mensagens vazias

                    // 3. Atualização otimista: Adiciona a mensagem e limpa o campo
                    adicionarMensagemNaTela({ texto: mensagem, remetente: 'cliente' });
                    const textoOriginal = mensagem;
                    inputMensagem.value = ''; 
                    btnEnviar.disabled = true;

                    try {
                        console.log(`[INFO] Enviando mensagem para o pedido ID: ${pedidoId}`);
                        
                        // 4. Envia os dados para o seu webhook do Make.com
                        const response = await fetch(ENVIAR_MENSAGEM_WEBHOOK_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-make-apikey': FRONTEND_API_KEY
                            },
                            body: JSON.stringify({
                                token: sessionToken,
                                dealId: pedidoId,
                                mensagem: mensagem,
                                responsibleId: responsibleIdAtual
                            })
                        });

                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        console.log('[SUCESSO] Mensagem enviada com sucesso.');

                    } catch (error) {
                        console.error('[ERRO] Falha ao enviar a mensagem:', error);
                        inputMensagem.value = textoOriginal;
                        alert('Houve um erro ao enviar sua mensagem. Por favor, tente novamente.');
                    } finally {
                        // 5. Reabilita o botão
                        btnEnviar.disabled = false;
                        inputMensagem.focus();
                    }
                });
            }
            // --- EVENT LISTENER PARA FORMULÁRIO DE FEEDBACK ---
            if (feedbackForm) {
                feedbackForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const comentario = feedbackText ? feedbackText.value.trim() : '';
                    
                    if (tipoAvaliacaoAtual !== null) {
                        await enviarAvaliacaoDesigner(tipoAvaliacaoAtual, comentario);
                    } else {
                        console.error('[ERRO] Tipo de avaliação não definido');
                    }
                });
            }
            // --- EVENT LISTENER PARA O BOTÃO MARCAR COMO VERIFICADO ---
            if (btnMarcarVerificado) {
                btnMarcarVerificado.addEventListener('click', () => { // A função não precisa mais ser async
                    // 1. Atualiza a interface imediatamente para o estado de sucesso
                    btnMarcarVerificado.disabled = true;
                    btnMarcarVerificado.className = 'btn-acao btn-verificado verificado';
                    btnMarcarVerificado.textContent = 'Verificado';

                    // 2. Dispara a requisição para o webhook (sem esperar pela resposta)
                    console.log(`[INFO] Marcando pedido ${pedidoId} como verificado.`);
                    fetch(MARCAR_VERIFICADO_WEBHOOK_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-make-apikey': FRONTEND_API_KEY
                        },
                        body: JSON.stringify({
                            token: sessionToken,
                            dealId: pedidoId
                        })
                    }).catch(error => {
                        // Opcional: Logar o erro no console discretamente, sem afetar a UI
                        console.error('[ERRO SILENCIOSO] Falha ao marcar como verificado:', error);
                    });
                });
            }

            // --- FUNÇÃO DEDICADA PARA ATUALIZAR O CARD ---
            // ESTA É A VERSÃO CORRIGIDA E COMPLETA DA FUNÇÃO
            function atualizarCardDesigner(responsibleId) {
                // Log para confirmar que a função foi chamada com o ID correto
                console.log(`[INFO] Atualizando card do designer. ID recebido: ${responsibleId}`);
            
                // Seleciona os elementos do DOM que precisam ser atualizados
                const designerAvatarEl = document.querySelector('.designer-avatar');
                const designerNomeEl = document.querySelector('.designer-details h4');
                const designerCargoEl = document.querySelector('.designer-details p');
            
                // VERIFICAÇÃO CRÍTICA: Confirma se os elementos do card existem na página.
                // Se algum deles não for encontrado, a função para e exibe um erro claro.
                if (!designerAvatarEl || !designerNomeEl || !designerCargoEl) {
                    console.error("[ERRO FATAL] Elementos do card do designer não encontrados no HTML. Verifique as classes: .designer-avatar, .designer-details h4, .designer-details p");
                    return; // Interrompe a execução para evitar falhas.
                }
            
                // Mapa de designers
                const designers = {
                    '115': { nome: 'Setor de Arte', cargo: 'Designer', avatar: 'https://setordearte.com.br/images/logo-redonda.svg' },
                    '10511': { nome: 'Talita', cargo: 'Designer', avatar: 'https://app.setordearte.com.br/images/talita.png' },
                    '10497': { nome: 'Sabrina', cargo: 'Designer', avatar: 'https://app.setordearte.com.br/images/sab.png' },
                    '10541': { nome: 'Tais', cargo: 'Designer', avatar: 'https://app.setordearte.com.br/images/tata.png' },
                    '10525': { nome: 'Ingrid', cargo: 'Designer', avatar: 'https://app.setordearte.com.br/images/cam.png' },
                    '9437': { nome: 'Ingra', cargo: 'Supervisora de Arte', avatar: 'https://app.setordearte.com.br/images/ingras.png' },
                    '10607': { nome: 'Natyelle', cargo: 'Designer', avatar: 'https://app.setordearte.com.br/images/naty.png' }
                };
            
                // Lógica de busca explícita e segura
                let designerInfo = designers[responsibleId];
            
                // Se o ID não for encontrado no mapa, usa o designer padrão '115'
                if (!designerInfo ) {
                    console.warn(`[AVISO] Designer com ID "${responsibleId}" não encontrado. Usando o designer padrão (ID 115).`);
                    designerInfo = designers['115'];
                }
            
                // Atualiza os elementos na tela com os dados corretos
                designerAvatarEl.src = designerInfo.avatar;
                designerNomeEl.textContent = designerInfo.nome;
                designerCargoEl.textContent = designerInfo.cargo;
            
                console.log(`[SUCESSO] Card do designer foi atualizado para: ${designerInfo.nome}`);
            }

            // --- FUNÇÃO PRINCIPAL PARA BUSCAR DADOS ---
            async function carregarDetalhesPedido() {
                try {
                    const response = await fetch(DETALHE_PEDIDO_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-make-apikey': FRONTEND_API_KEY },
                        body: JSON.stringify({ token: sessionToken, dealId: pedidoId })
                    });

                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                    let data = await response.json();

                    if (typeof data.Body === 'string') {
                        data = JSON.parse(data.Body);
                    } else if (typeof data === 'string') {
                        data = JSON.parse(data);
                    }

                    if (data.status !== 'success' || !data.pedido) {
                        throw new Error("Resposta do webhook inválida ou sem o objeto 'pedido'.");
                    }
                    
                    const pedido = data.pedido;
                    console.log("[DEBUG] Objeto 'pedido' recebido:", pedido);
                    // --- INÍCIO DA LÓGICA CORRIGIDA ---
if (btnVerAtendimento && pedido.LinkGrupoWhatsApp) {
    btnVerAtendimento.href = pedido.LinkGrupoWhatsApp;
    btnVerAtendimento.target = '_blank'; // Abre em nova aba
    btnVerAtendimento.classList.remove('disabled');
}
                    const novoStatus = pedido.STAGE_ID;
                    responsibleIdAtual = pedido.RESPONSIBLE_ID;
                    
                    console.log(`[INFO] ID do Designer Responsável armazenado: ${responsibleIdAtual}`);

                    if (statusAtualDoPedido !== null && statusAtualDoPedido !== novoStatus) {
                        window.location.reload();
                        return;
                    }
                    statusAtualDoPedido = novoStatus;

                    // Chamada para a função que atualiza o card do designer
                    atualizarCardDesigner(pedido.RESPONSIBLE_ID);

                    document.getElementById('pedido-titulo-detalhe').textContent = `Pedido #${pedido.ID}: ${pedido.TITLE}`;
                    document.getElementById('info-id').textContent = `#${pedido.ID}`;
                    document.getElementById('info-valor').textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(pedido.OPPORTUNITY) || 0);
                    document.getElementById('info-cliente').textContent = pedido.UF_CRM_1741273407628 || 'Não informado';

                    let statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };
                    const stageId = pedido.STAGE_ID || "";

                    if (stageId === "NEW" || stageId === "C17:NEW") statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                    else if (stageId === "LOSE") statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' };
                    else if (stageId === "C17:UC_2OEE24") statusInfo = { texto: 'Em Análise', classe: 'status-analise' };
                    else if (["C17:PREPARATION", "C17:UC_Y31VM3", "C17:UC_HX3875", "C17:UC_EYLXL0"].includes(stageId)) statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };
                    else if ((stageId.includes("WON") && stageId !== "C17:WON") || stageId === "C17:1") statusInfo = { texto: "Aprovado", classe: "status-aprovado" };
                    else if (stageId === "C17:WON" || stageId.includes("C19")) statusInfo = { texto: "Verificado", classe: "status-verificado" };
                    
                    document.getElementById("pedido-status-detalhe").innerHTML = `<span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span>`;

                    const avisoAnaliseBanner = document.getElementById("aviso-analise-banner");
                    if (pedido.STAGE_ID === 'C17:UC_2OEE24') avisoAnaliseBanner.classList.remove('hidden');
                    else avisoAnaliseBanner.classList.add('hidden');

                    if (btnCancelar && (pedido.STAGE_ID.includes('WON') || pedido.STAGE_ID.includes('LOSE') || pedido.STAGE_ID === "C17:1" || pedido.STAGE_ID === "C17:WON" || pedido.STAGE_ID.includes("C19"))) {
                        btnCancelar.disabled = true;
                        btnCancelar.textContent = "Pedido não pode ser cancelado";
                    }

                    const arquivosBox = document.getElementById('arquivos-box');
                    const linkDownload = pedido.UF_CRM_1748277308731;

                    if ((pedido.STAGE_ID.includes('WON') || pedido.STAGE_ID === "C17:1" || pedido.STAGE_ID.includes('C19')) && linkDownload) {
                        arquivosBox.innerHTML = `<a href="${linkDownload}" target="_blank" class="btn-acao btn-download">Baixar Arquivo Final</a>`;
                        if (btnMarcarVerificado) {
                            if (pedido.STAGE_ID === "C17:WON" || pedido.STAGE_ID.includes("C19")) {
                                btnMarcarVerificado.style.display = 'block';
                                btnMarcarVerificado.className = 'btn-acao btn-verificado verificado';
                                btnMarcarVerificado.textContent = "Verificado";
                                btnMarcarVerificado.disabled = true;
                            } else {
                                btnMarcarVerificado.style.display = 'block';
                                btnMarcarVerificado.className = 'btn-acao btn-verificado tooltip';
                                btnMarcarVerificado.innerHTML = `Marcar como Verificado<span class="tooltiptext">Ao verificar esse arquivo nenhuma mudança a mais será feita e o pagamento será liberado ao freelancer. <a href="/ajuda-verificacao" target="_blank" style="color: #3498db;">Saiba mais</a></span>`;
                            }
                        }
                    } else if (pedido.STAGE_ID.includes('WON') || pedido.STAGE_ID === "C17:1" || pedido.STAGE_ID.includes('C19')) {
                        arquivosBox.innerHTML = `<p class="info-text">O arquivo final ainda não foi disponibilizado.</p>`;
                        if (btnMarcarVerificado) btnMarcarVerificado.style.display = 'none';
                    } else {
                        arquivosBox.innerHTML = `<p class="info-text">O arquivo para download estará disponível aqui quando o pedido for finalizado.</p>`;
                        if (btnMarcarVerificado) btnMarcarVerificado.style.display = 'none';
                    }

                    mensagensContainer.innerHTML = '';
                    if (data.historicoMensagens && data.historicoMensagens.length > 0) {
                        data.historicoMensagens.forEach(msg => adicionarMensagemNaTela({ texto: msg.COMMENT, remetente: String(msg.AUTHOR_ID) === '115' ? 'cliente' : 'designer' }));
                    } else {
                        mensagensContainer.innerHTML = '<p class="info-text">Nenhuma mensagem ainda. Seja o primeiro a enviar!</p>';
                    }

                } catch (error) {
                    console.error("[ERRO] Falha ao carregar detalhes do pedido:", error);
                    if (detalhesWrapper) detalhesWrapper.innerHTML = `<h1>Erro ao carregar dados</h1><p>Não foi possível buscar os detalhes do pedido. Tente recarregar a página.</p>`;
                }
            }

            function adicionarMensagemNaTela(msg) {
                const infoText = mensagensContainer.querySelector('.info-text');
                if (infoText) infoText.remove();
                const divMensagem = document.createElement('div');
                const classe = msg.remetente === 'cliente' ? 'mensagem-cliente' : 'mensagem-designer';
                divMensagem.classList.add('mensagem', classe);
                divMensagem.textContent = `${msg.remetente === 'cliente' ? 'Você' : 'Designer'}: ${msg.texto}`;
                mensagensContainer.appendChild(divMensagem);
                mensagensContainer.scrollTop = mensagensContainer.scrollHeight;
            }

            // --- EXECUÇÃO INICIAL APENAS ---
            carregarDetalhesPedido();
            // REMOVIDO: setInterval(carregarDetalhesPedido, 15000); - Causava loop custoso no webhook

        } catch (e) {
            console.error("[ERRO GERAL] Ocorreu um erro inesperado no script de detalhe do pedido:", e);
        }
    });
})();


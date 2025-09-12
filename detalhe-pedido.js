// /detalhe-pedido.js - VERSÃO COM DEPURAÇÃO DETALHADA

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        try {
            const sessionToken = localStorage.getItem('sessionToken');
            const userName = localStorage.getItem('userName');
            const urlParams = new URLSearchParams(window.location.search);
            const pedidoId = urlParams.get('id');

            // --- ELEMENTOS DO DOM ---
            const tituloEl = document.getElementById('pedido-titulo-detalhe');
            const valorEl = document.getElementById('info-valor');
            const clienteEl = document.getElementById('info-cliente');
            const idEl = document.getElementById('info-id');
            const statusEl = document.getElementById('pedido-status-detalhe');
            const btnVerAtendimento = document.getElementById('btn-ver-atendimento');
            const arquivosBox = document.getElementById('arquivos-box');
            const btnMarcarVerificado = document.getElementById('btn-marcar-verificado');
            const btnCancelar = document.getElementById('btn-cancelar');
            // const designerAvatarEl = document.querySelector('.designer-avatar'); // Removido
            // const designerNomeEl = document.querySelector('.designer-details h4'); // Removido
            const formMensagem = document.getElementById('form-mensagem');
            const inputMensagem = document.getElementById('input-mensagem');
            const btnEnviar = document.getElementById('btn-enviar-mensagem');
            const mensagensContainer = document.getElementById('mensagens-container');

            if (!sessionToken) {
                window.location.href = 'login';
                return;
            }
            if (!pedidoId) {
                tituloEl.textContent = 'Erro: ID do pedido não fornecido.';
                return;
            }
            
            document.getElementById('user-greeting').textContent = `Olá, ${userName}!`;
            document.getElementById('logout-button').addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login';
            });

            async function carregarDetalhesPedido() {
                try {
                    console.log('[DEBUG] Iniciando busca de detalhes para o pedido ID:', pedidoId);
                    const response = await fetch('/api/getDealDetails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId })
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.message || 'Erro ao buscar dados.');
                    }
                    
                    const pedido = data.pedido;
                    console.log('[DEBUG] Dados do pedido recebidos da API:', pedido);

                    tituloEl.textContent = `Pedido #${pedido.ID}: ${pedido.TITLE}`;
                    idEl.textContent = `#${pedido.ID}`;
                    valorEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.OPPORTUNITY);
                    clienteEl.textContent = pedido.NOME_CLIENTE_FINAL || 'Não informado';

                    if (btnVerAtendimento && pedido.LINK_ATENDIMENTO) {
                        btnVerAtendimento.href = pedido.LINK_ATENDIMENTO;
                        btnVerAtendimento.target = '_blank';
                        btnVerAtendimento.classList.remove('disabled');
                    }
                    
                    // --- INÍCIO DO BLOCO DE DEPURAÇÃO DE STATUS ---
                    console.log(`[DEBUG] Verificando STAGE_ID recebido: '${pedido.STAGE_ID}' (Tipo: ${typeof pedido.STAGE_ID})`);

                    let statusInfo = { texto: 'Desconhecido', classe: '' };
                    const stageId = pedido.STAGE_ID || ""; // Garante que stageId seja sempre uma string

                    try {
                        console.log('[DEBUG] Entrando na lógica de definição de status...');
                        if (stageId.includes("NEW")) {
                            statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                        } else if (stageId.includes("LOSE")) {
                            statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' };
                        } else if (stageId === "C17:UC_2OEE24") {
                            statusInfo = { texto: 'Em Análise', classe: 'status-analise' };
                        } else if ((stageId.includes("WON") && stageId !== "C17:WON") || stageId === "C17:1") {
                            statusInfo = { texto: "Aprovado", classe: "status-aprovado" };
                        } else if (stageId === "C17:WON" || stageId.includes("C19")) {
                            statusInfo = { texto: "Verificado", classe: "status-verificado" };
                        } else {
                            statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };
                        }
                        console.log('[DEBUG] Lógica de status concluída. Status definido como:', statusInfo);
                    } catch (statusError) {
                        console.error("[ERRO FATAL] Erro dentro do bloco de lógica de status:", statusError);
                        statusInfo = { texto: 'Erro de Status', classe: 'status-cancelado' };
                    }
                    // --- FIM DO BLOCO DE DEPURAÇÃO DE STATUS ---
                    
                    statusEl.innerHTML = `<span class="status-badge ${statusInfo.classe}" data-stage-id="${stageId}">${statusInfo.texto}</span>`;
                    
                    console.log('[DEBUG] Iniciando lógica de exibição do botão de download...');
                    const linkDownload = pedido.LINK_ARQUIVO_FINAL;
                    const isFinalizado = (stageId.includes("WON") || stageId === "C17:1" || stageId.includes("C19"));

                    if (isFinalizado) {
                        if (linkDownload) {
                            arquivosBox.innerHTML = `<a href="${linkDownload}" target="_blank" class="btn-acao btn-download">Baixar Arquivo Final</a>`;
                        } else {
                            arquivosBox.innerHTML = `<p class="info-text">O arquivo final ainda não foi disponibilizado.</p>`;
                        }
                    } else {
                        arquivosBox.innerHTML = `<p class="info-text">O arquivo para download estará disponível aqui quando o pedido for finalizado.</p>`;
                    }
                    // Lógica para exibir e controlar o botão "Marcar como Verificado"
                    if (isFinalizado) {
                        btnMarcarVerificado.style.display = 'block'; // Mostra o botão
                        
                        if (stageId === "C17:WON" || stageId.includes("C19")) {
                            btnMarcarVerificado.disabled = true;
                            btnMarcarVerificado.textContent = "Verificado";
                        } else {
                            btnMarcarVerificado.disabled = false;
                            btnMarcarVerificado.textContent = "Marcar como Verificado";
                        }
                    } else {
                        btnMarcarVerificado.style.display = 'none'; // Esconde o botão
                    }
                    console.log('[DEBUG] Lógica do botão de download concluída.');
                    // Lógica para desabilitar o botão de cancelar
                    const isAprovadoOuVerificado = (
                        (stageId.includes("WON") && stageId !== "C17:WON") || 
                        stageId === "C17:1" || 
                        stageId === "C17:WON" || 
                        stageId.includes("C19")
                    );

                    if (btnCancelar && isAprovadoOuVerificado) {
                        btnCancelar.disabled = true;
                        btnCancelar.textContent = "Pedido Finalizado";
                    }
                    // Renderiza o histórico de mensagens
                    mensagensContainer.innerHTML = '';
                    if (pedido.historicoMensagens && pedido.historicoMensagens.length > 0) {
                        pedido.historicoMensagens.forEach(adicionarMensagemNaTela);
                    } else {
                        mensagensContainer.innerHTML = '<p class="info-text">Nenhuma mensagem ainda. Seja o primeiro a enviar!</p>';
                    }
                } catch (error) {
                    console.error("Falha ao carregar detalhes do pedido:", error);
                    document.getElementById("detalhes-wrapper").innerHTML = `<h1>Erro ao carregar dados</h1><p>${error.message}</p>`;
                }
            }
            function adicionarMensagemNaTela(msg) {
                const infoText = mensagensContainer.querySelector('.info-text');
                if (infoText) infoText.remove();
                
                const divMensagem = document.createElement('div');
                const classe = msg.remetente === 'cliente' ? 'mensagem-cliente' : 'mensagem-designer';
                divMensagem.classList.add('mensagem', classe);
                
                // Remove o prefixo "[Mensagem do Cliente]\n--------------------\n" se existir
                const textoLimpo = msg.texto.replace(/^\[Mensagem do Cliente\]\n-+\n/, '');
                divMensagem.textContent = textoLimpo;
                
                mensagensContainer.appendChild(divMensagem);
                mensagensContainer.scrollTop = mensagensContainer.scrollHeight;
            }
            carregarDetalhesPedido();
// Adiciona o evento de clique para o botão
            if (btnMarcarVerificado) {
                btnMarcarVerificado.addEventListener('click', async () => {
                    if (!confirm('Tem certeza que deseja marcar este pedido como verificado? Esta ação não pode ser desfeita e liberará o pagamento para o designer.')) {
                        return;
                    }

                    btnMarcarVerificado.disabled = true;
                    btnMarcarVerificado.textContent = 'Verificando...';

                    try {
                        const response = await fetch('/api/markAsVerified', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId })
                        });
                        
                        const data = await response.json();
                        if (!response.ok) {
                            throw new Error(data.message);
                        }
                        
                        // Recarrega os dados para mostrar o novo status "Verificado"
                        await carregarDetalhesPedido();

                    } catch (error) {
                        alert(`Erro: ${error.message}`);
                        btnMarcarVerificado.disabled = false;
                        btnMarcarVerificado.textContent = 'Marcar como Verificado';
                    }
                });
            }
            // Adiciona o evento de clique para o botão de cancelar
            if (btnCancelar) {
                btnCancelar.addEventListener('click', async () => {
                    const stageId = statusEl.querySelector('.status-badge').dataset.stageId || "";
                    let confirmacao = false;
                    
                    // Verifica se o status requer confirmação extra
                    const precisaConfirmar = (
                        !stageId.includes("NEW") && 
                        stageId !== "C17:UC_2OEE24" // Não é "Aguardando Pagamento" nem "Em Análise"
                    );

                    if (precisaConfirmar) {
                        confirmacao = confirm("O atendimento deste pedido já pode ter começado. O valor pago pode não ser reembolsável. Deseja cancelar mesmo assim?");
                    } else {
                        confirmacao = confirm("Tem certeza que deseja cancelar este pedido?");
                    }

                    if (confirmacao) {
                        btnCancelar.disabled = true;
                        btnCancelar.textContent = 'Cancelando...';

                        try {
                            const response = await fetch('/api/cancelDeal', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId })
                            });
                            
                            const data = await response.json();
                            if (!response.ok) {
                                throw new Error(data.message);
                            }
                            
                            // Recarrega os dados para mostrar o novo status "Cancelado"
                            await carregarDetalhesPedido();

                        } catch (error) {
                            alert(`Erro: ${error.message}`);
                            btnCancelar.disabled = false;
                            btnCancelar.textContent = 'Cancelar Pedido';
                        }
                    }
                });
            }
            // Adiciona o evento de envio de mensagem
            if (formMensagem) {
                formMensagem.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const mensagem = inputMensagem.value.trim();
                    if (!mensagem) return;

                    const textoOriginal = mensagem;
                    inputMensagem.value = ''; 
                    btnEnviar.disabled = true;
                    
                    adicionarMensagemNaTela({ texto: textoOriginal, remetente: 'cliente' });

                    try {
                        const response = await fetch('/api/sendMessage', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionToken: sessionToken,
                                dealId: pedidoId,
                                message: textoOriginal
                            })
                        });
                        if (!response.ok) throw new Error('Falha ao enviar mensagem.');
                    } catch (error) {
                        console.error('Erro ao enviar mensagem:', error);
                        alert('Houve um erro ao enviar sua mensagem. Por favor, tente novamente.');
                        // Devolve a mensagem ao input em caso de erro
                        const ultimaMsg = mensagensContainer.lastChild;
                        if (ultimaMsg) ultimaMsg.remove();
                        inputMensagem.value = textoOriginal;
                    } finally {
                        btnEnviar.disabled = false;
                        inputMensagem.focus();
                    }
                });
            }

            // --- LÓGICA DO NOVO MODAL DE AVALIAÇÃO ---
            const btnAbrirAvaliacao = document.getElementById('btn-abrir-avaliacao');
            const modalAvaliacao = document.getElementById('modal-avaliacao-designer');
            const formAvaliacao = document.getElementById('form-avaliacao');
            const btnLike = modalAvaliacao.querySelector('.btn-avaliacao.like');
            const btnDislike = modalAvaliacao.querySelector('.btn-avaliacao.dislike');
            const comentarioInput = document.getElementById('avaliacao-comentario');
            let avaliacaoSelecionada = null;

            // Abrir o modal
            btnAbrirAvaliacao.addEventListener('click', () => {
                modalAvaliacao.classList.add('active');
            });

            // Fechar o modal
            modalAvaliacao.querySelector('.close-modal').addEventListener('click', () => {
                modalAvaliacao.classList.remove('active');
            });

            // Selecionar avaliação
            btnLike.addEventListener('click', () => {
                avaliacaoSelecionada = 'positiva';
                btnLike.classList.add('active');
                btnDislike.classList.remove('active');
            });

            btnDislike.addEventListener('click', () => {
                avaliacaoSelecionada = 'negativa';
                btnDislike.classList.add('active');
                btnLike.classList.remove('active');
            });

            // Enviar formulário
            formAvaliacao.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!avaliacaoSelecionada) {
                    alert('Por favor, selecione uma avaliação (positiva ou negativa).');
                    return;
                }

                const comentario = comentarioInput.value.trim();

                console.log('--- AVALIAÇÃO ENVIADA ---');
                console.log('Pedido ID:', pedidoId);
                console.log('Avaliação:', avaliacaoSelecionada);
                console.log('Comentário:', comentario);
                // Futuramente, aqui virá a chamada para a API
                // await fetch('/api/enviarAvaliacao', { ... });

                alert('Obrigado pela sua avaliação!');
                
                // Limpar e fechar o modal
                avaliacaoSelecionada = null;
                btnLike.classList.remove('active');
                btnDislike.classList.remove('active');
                comentarioInput.value = '';
                modalAvaliacao.classList.remove('active');
            });

        } catch (e) {
            console.error("Ocorreu um erro inesperado no script de detalhe do pedido:", e);
        }
    });
})();
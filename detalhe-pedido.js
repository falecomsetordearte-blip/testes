// /detalhe-pedido.js
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
            const formMensagem = document.getElementById('form-mensagem');
            const inputMensagem = document.getElementById('input-mensagem');
            const btnEnviar = document.getElementById('btn-enviar-mensagem');
            const mensagensContainer = document.getElementById('mensagens-container');
            const btnAbrirAvaliacao = document.getElementById('btn-abrir-avaliacao');

            if (!sessionToken) { window.location.href = 'login'; return; }
            if (!pedidoId) { tituloEl.textContent = 'Erro: ID do pedido não fornecido.'; return; }
            
            document.getElementById('user-greeting').textContent = `Olá, ${userName}!`;
            document.getElementById('logout-button').addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login';
            });

            async function carregarDetalhesPedido() {
                try {
                    const response = await fetch('/api/getDealDetails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId })
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Erro ao buscar dados.');
                    
                    const pedido = data.pedido;

                    tituloEl.textContent = `Pedido #${pedido.ID}: ${pedido.TITLE}`;
                    idEl.textContent = `#${pedido.ID}`;
                    valorEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.OPPORTUNITY);
                    clienteEl.textContent = pedido.NOME_CLIENTE_FINAL || 'Não informado';

                    if (btnVerAtendimento && pedido.LINK_ATENDIMENTO) {
                        btnVerAtendimento.href = pedido.LINK_ATENDIMENTO;
                        btnVerAtendimento.target = '_blank';
                        btnVerAtendimento.classList.remove('disabled');
                    }
                    
                    // Lógica para esconder o botão se já foi avaliado
                    if (pedido.jaAvaliado) {
                        btnAbrirAvaliacao.style.display = 'none';
                    } else {
                        btnAbrirAvaliacao.style.display = 'block';
                    }
                    
                    let statusInfo = { texto: 'Desconhecido', classe: '' };
                    const stageId = pedido.STAGE_ID || ""; 

                    if (stageId.includes("NEW")) { statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' }; } 
                    else if (stageId.includes("LOSE")) { statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' }; } 
                    else if (stageId === "C17:UC_2OEE24") { statusInfo = { texto: 'Em Análise', classe: 'status-analise' }; } 
                    else if ((stageId.includes("WON") && stageId !== "C17:WON") || stageId === "C17:1") { statusInfo = { texto: "Aprovado", classe: "status-aprovado" }; } 
                    else if (stageId === "C17:WON" || stageId.includes("C19")) { statusInfo = { texto: "Verificado", classe: "status-verificado" }; } 
                    else { statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' }; }
                    
                    statusEl.innerHTML = `<span class="status-badge ${statusInfo.classe}" data-stage-id="${stageId}">${statusInfo.texto}</span>`;
                    
                    const linkDownload = pedido.LINK_ARQUIVO_FINAL;
                    const isFinalizado = (stageId.includes("WON") || stageId === "C17:1" || stageId.includes("C19"));

                    if (isFinalizado) {
                        if (linkDownload) { arquivosBox.innerHTML = `<a href="${linkDownload}" target="_blank" class="btn-acao btn-download">Baixar Arquivo Final</a>`; } 
                        else { arquivosBox.innerHTML = `<p class="info-text">O arquivo final ainda não foi disponibilizado.</p>`; }
                        btnMarcarVerificado.style.display = 'block';
                        if (stageId === "C17:WON" || stageId.includes("C19")) { btnMarcarVerificado.disabled = true; btnMarcarVerificado.textContent = "Verificado"; } 
                        else { btnMarcarVerificado.disabled = false; btnMarcarVerificado.textContent = "Marcar como Verificado"; }
                    } else {
                        arquivosBox.innerHTML = `<p class="info-text">O arquivo para download estará disponível aqui quando o pedido for finalizado.</p>`;
                        btnMarcarVerificado.style.display = 'none';
                    }
                    
                    const isAprovadoOuVerificado = ((stageId.includes("WON") && stageId !== "C17:WON") || stageId === "C17:1" || stageId === "C17:WON" || stageId.includes("C19"));
                    if (btnCancelar && isAprovadoOuVerificado) {
                        btnCancelar.disabled = true;
                        btnCancelar.textContent = "Pedido Finalizado";
                    }
                    
                    mensagensContainer.innerHTML = '';
                    if (pedido.historicoMensagens && pedido.historicoMensagens.length > 0) {
                        pedido.historicoMensagens.forEach(adicionarMensagemNaTela);
                    } else {
                        mensagensContainer.innerHTML = '<p class="info-text">Nenhuma mensagem ainda. Seja o primeiro a enviar!</p>';
                    }
                } catch (error) {
                    document.getElementById("detalhes-wrapper").innerHTML = `<h1>Erro ao carregar dados</h1><p>${error.message}</p>`;
                }
            }

            function adicionarMensagemNaTela(msg) {
                const infoText = mensagensContainer.querySelector('.info-text');
                if (infoText) infoText.remove();
                
                const divMensagem = document.createElement('div');
                const classe = msg.remetente === 'cliente' ? 'mensagem-cliente' : 'mensagem-designer';
                divMensagem.classList.add('mensagem', classe);
                const textoLimpo = msg.texto.replace(/^\[Mensagem do Cliente\]\n-+\n/, '');
                divMensagem.textContent = textoLimpo;
                
                mensagensContainer.appendChild(divMensagem);
                mensagensContainer.scrollTop = mensagensContainer.scrollHeight;
            }

            carregarDetalhesPedido();

            if (btnMarcarVerificado) {
                btnMarcarVerificado.addEventListener('click', async () => {
                    if (!confirm('Tem certeza que deseja marcar este pedido como verificado? Esta ação não pode ser desfeita e liberará o pagamento para o designer.')) return;
                    btnMarcarVerificado.disabled = true;
                    btnMarcarVerificado.textContent = 'Verificando...';
                    try {
                        const response = await fetch('/api/markAsVerified', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId })
                        });
                        if (!response.ok) { const data = await response.json(); throw new Error(data.message); }
                        await carregarDetalhesPedido();
                    } catch (error) {
                        alert(`Erro: ${error.message}`);
                        btnMarcarVerificado.disabled = false;
                        btnMarcarVerificado.textContent = 'Marcar como Verificado';
                    }
                });
            }

            if (btnCancelar) {
                btnCancelar.addEventListener('click', async () => {
                    const stageId = statusEl.querySelector('.status-badge').dataset.stageId || "";
                    const precisaConfirmar = (!stageId.includes("NEW") && stageId !== "C17:UC_2OEE24");
                    const msgConfirm = precisaConfirmar ? "O atendimento deste pedido já pode ter começado. O valor pago pode não ser reembolsável. Deseja cancelar mesmo assim?" : "Tem certeza que deseja cancelar este pedido?";
                    if (confirm(msgConfirm)) {
                        btnCancelar.disabled = true;
                        btnCancelar.textContent = 'Cancelando...';
                        try {
                            const response = await fetch('/api/cancelDeal', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId })
                            });
                            if (!response.ok) { const data = await response.json(); throw new Error(data.message); }
                            await carregarDetalhesPedido();
                        } catch (error) {
                            alert(`Erro: ${error.message}`);
                            btnCancelar.disabled = false;
                            btnCancelar.textContent = 'Cancelar Pedido';
                        }
                    }
                });
            }
            
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
                            body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId, message: textoOriginal })
                        });
                        if (!response.ok) throw new Error('Falha ao enviar mensagem.');
                    } catch (error) {
                        alert('Houve um erro ao enviar sua mensagem. Por favor, tente novamente.');
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
            const modalAvaliacao = document.getElementById('modal-avaliacao-designer');
            const formAvaliacao = document.getElementById('form-avaliacao');
            const btnLike = modalAvaliacao.querySelector('.btn-avaliacao.like');
            const btnDislike = modalAvaliacao.querySelector('.btn-avaliacao.dislike');
            const comentarioInput = document.getElementById('avaliacao-comentario');
            const submitAvaliacaoBtn = formAvaliacao.querySelector('button[type="submit"]');
            let avaliacaoSelecionada = null;

            btnAbrirAvaliacao.addEventListener('click', () => modalAvaliacao.classList.add('active'));
            modalAvaliacao.querySelector('.close-modal').addEventListener('click', () => modalAvaliacao.classList.remove('active'));

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

            formAvaliacao.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!avaliacaoSelecionada) {
                    alert('Por favor, selecione uma avaliação (positiva ou negativa).');
                    return;
                }

                submitAvaliacaoBtn.disabled = true;
                submitAvaliacaoBtn.textContent = 'Enviando...';

                try {
                    const response = await fetch('/api/submitDesignerReview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionToken: sessionToken,
                            dealId: pedidoId,
                            avaliacao: avaliacaoSelecionada,
                            comentario: comentarioInput.value.trim()
                        })
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Ocorreu um erro.');

                    alert('Obrigado pela sua avaliação!');
                    
                    btnAbrirAvaliacao.style.display = 'none'; // Esconde o botão após avaliar

                    avaliacaoSelecionada = null;
                    btnLike.classList.remove('active');
                    btnDislike.classList.remove('active');
                    comentarioInput.value = '';
                    modalAvaliacao.classList.remove('active');

                } catch (error) {
                    alert(`Erro: ${error.message}`);
                } finally {
                    submitAvaliacaoBtn.disabled = false;
                    submitAvaliacaoBtn.textContent = 'Enviar Avaliação';
                }
            });

        } catch (e) {
            console.error("Ocorreu um erro inesperado no script de detalhe do pedido:", e);
        }
    });
})();
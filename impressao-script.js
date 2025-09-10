// /impressao-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) { window.location.href = 'login.html'; return; }

        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = []; // Armazena todos os deals carregados para uso no modal

        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                const filters = await response.json();
                if (!response.ok) throw new Error('Falha ao carregar filtros.');

                filters.impressoras.forEach(option => {
                    impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`;
                });
                filters.materiais.forEach(option => {
                    materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`;
                });
            } catch (error) {
                console.error("Erro ao carregar opções de filtro:", error);
            }
        }

        async function carregarPedidosDeProducao() {
            document.querySelectorAll('.column-cards').forEach(col => {
                col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>';
            });
            
            try {
                const response = await fetch('/api/getProductionDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        impressoraFilter: impressoraFilterEl.value,
                        materialFilter: materialFilterEl.value
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                allDealsData = data.deals; // Salva os dados para uso posterior
                organizarPedidosNasColunas(allDealsData);

            } catch (error) {
                console.error("Erro ao carregar pedidos de produção:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            const agora = new Date();
            
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoEmMinutos = parseInt(deal.UF_CRM_1757466402085, 10);
                
                if (!isNaN(prazoEmMinutos)) {
                    const dataCriacao = new Date(deal.DATE_CREATE);
                    const prazoFinal = new Date(dataCriacao.getTime() + prazoEmMinutos * 60000);
                    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
                    const prazoData = new Date(prazoFinal.getFullYear(), prazoFinal.getMonth(), prazoFinal.getDate());
                    const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else if (diffDays <= 14) colunaId = 'PROXIMA_SEMANA';
                }
                
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) {
                    coluna.innerHTML += cardHtml;
                }
            });

            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
            });
        }

        function createCardHtml(deal) {
            const linkVerPedido = deal.UF_CRM_1741349861326;
            return `
                <div class="kanban-card">
                    <div class="card-title">#${deal.ID} - ${deal.TITLE}</div>
                    <div class="card-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        ${linkVerPedido ? `<a href="${linkVerPedido}" target="_blank" class="btn-acao btn-verificar">Ver Pedido</a>` : ''}
                        <button class="btn-acao" data-action="open-details-modal" data-deal-id="${deal.ID}">
                            Detalhes
                        </button>
                    </div>
                </div>
            `;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;

            modalTitle.textContent = `Detalhes do Pedido #${deal.ID} - ${deal.TITLE}`;
            
            let chatHtml = '<p class="info-text">Nenhuma mensagem.</p>';
            if (deal.historicoMensagens.length > 0) {
                chatHtml = deal.historicoMensagens.map(msg => {
                    const classe = msg.remetente === 'cliente' ? 'mensagem-cliente' : 'mensagem-designer';
                    const textoLimpo = msg.texto.replace(/^\[Mensagem do Cliente\]\n-+\n/, '');
                    return `<div class="mensagem ${classe}">${textoLimpo}</div>`;
                }).join('');
            }

            const stageId = deal.STAGE_ID || "";
            const linkArquivo = deal.UF_CRM_1748277308731;
            const isFinalizado = (stageId.includes("WON") || stageId === "C17:1" || stageId.includes("C19")); // Replicando a lógica
            let arquivoHtml = '<p class="info-text">O arquivo para download estará disponível aqui quando o pedido for finalizado.</p>';
            if (isFinalizado && linkArquivo) {
                arquivoHtml = `<a href="${linkArquivo}" target="_blank" class="btn-acao btn-download">Baixar Arquivo</a>`;
            } else if (isFinalizado) {
                arquivoHtml = '<p class="info-text">O arquivo final ainda não foi disponibilizado.</p>';
            }

            let verificarHtml = '';
            if (isFinalizado) {
                const isVerificado = stageId === "C17:WON" || stageId.includes("C19");
                verificarHtml = `
                    <button class="btn-acao btn-verificado" data-action="mark-as-verified" data-deal-id="${deal.ID}" ${isVerificado ? 'disabled' : ''}>
                        ${isVerificado ? 'Verificado' : 'Marcar como Verificado'}
                    </button>`;
            }

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">
                        <div class="card-detalhe">
                            <h3>Conversa</h3>
                            <div class="chat-box" style="height: 300px; display: flex; flex-direction: column;">
                                <div id="modal-mensagens-container" style="overflow-y: auto; flex-grow: 1; padding-right: 10px;">${chatHtml}</div>
                                <form id="modal-form-mensagem" class="form-mensagem" style="margin-top: 15px;">
                                    <input type="text" class="input-mensagem" placeholder="Digite sua mensagem..." required>
                                    <button type="submit" class="btn-enviar-mensagem">Enviar</button>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe">
                            <h3>Arquivos e Verificação</h3>
                            <div id="modal-arquivos-box">${arquivoHtml}</div>
                            <div id="modal-verificar-box" style="margin-top: 15px;">${verificarHtml}</div>
                        </div>
                    </div>
                </div>
            `;
            
            modal.classList.add('active');
            attachModalEventListeners(deal);
        }

        function attachModalEventListeners(deal) {
            const formMensagemModal = document.getElementById('modal-form-mensagem');
            if (formMensagemModal) {
                formMensagemModal.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const input = formMensagemModal.querySelector('.input-mensagem');
                    const mensagem = input.value.trim();
                    if (!mensagem) return;

                    input.disabled = true;
                    formMensagemModal.querySelector('button').disabled = true;

                    try {
                        const response = await fetch('/api/sendMessage', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionToken, dealId: deal.ID, message: mensagem })
                        });
                        if (!response.ok) throw new Error('Falha ao enviar mensagem.');
                        
                        input.value = ''; // Limpa o campo em caso de sucesso
                        // Para atualizar o chat visualmente, precisaríamos recarregar ou adicionar a mensagem
                    } catch (error) {
                        alert(error.message);
                    } finally {
                        input.disabled = false;
                        formMensagemModal.querySelector('button').disabled = false;
                    }
                });
            }

            const btnVerificarModal = document.querySelector('#modal-verificar-box button');
            if (btnVerificarModal) {
                btnVerificarModal.addEventListener('click', async () => {
                    if (!confirm('Tem certeza que deseja marcar este pedido como verificado?')) return;
                    
                    btnVerificarModal.disabled = true;
                    btnVerificarModal.textContent = 'Verificando...';
                    
                    try {
                        const response = await fetch('/api/markAsVerified', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionToken, dealId: deal.ID })
                        });
                        if (!response.ok) throw new Error('Falha ao marcar como verificado.');
                        
                        alert('Pedido verificado com sucesso!');
                        modal.classList.remove('active');
                        carregarPedidosDeProducao(); // Recarrega a lista principal
                    } catch(error) {
                        alert(error.message);
                        btnVerificarModal.disabled = false;
                        btnVerificarModal.textContent = 'Marcar como Verificado';
                    }
                });
            }
        }
        
        btnFiltrar.addEventListener('click', carregarPedidosDeProducao);
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });

        board.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="open-details-modal"]');
            if (button) {
                openDetailsModal(button.dataset.dealId);
            }
        });
        
        async function init() {
            await carregarOpcoesDeFiltro();
            await carregarPedidosDeProducao();
        }

        init();
    });
})();
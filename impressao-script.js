// /impressao-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        // --- AUTENTICAÇÃO E ELEMENTOS DO DOM ---
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

        // --- FUNÇÕES DE CARREGAMENTO DE DADOS ---

        async function carregarOpcoesDeFiltro() { /* ... código existente, sem alterações ... */ }

        async function carregarPedidosDeProducao() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            
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

                organizarPedidosNasColunas(data.deals);

            } catch (error) {
                console.error("Erro ao carregar pedidos:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        // --- FUNÇÃO PARA ORGANIZAR OS CARDS ---
        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');

            const agora = new Date();
            
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoEmMinutos = parseInt(deal.UF_CRM_1757466402085, 10);
                
                if (!isNaN(prazoEmMinutos)) {
                    const dataCriacao = new Date(deal.DATE_CREATE);
                    const prazoFinal = new Date(dataCriacao.getTime() + prazoEmMinutos * 60000);

                    // Normaliza as datas para comparar apenas o dia
                    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
                    const prazoData = new Date(prazoFinal.getFullYear(), prazoFinal.getMonth(), prazoFinal.getDate());
                    
                    const diffTime = prazoData - hoje;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else if (diffDays <= 14) colunaId = 'PROXIMA_SEMANA';
                    // Se for mais que 14 dias, fica em 'PROXIMA_SEMANA' para simplificar
                }
                
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) {
                    coluna.innerHTML += cardHtml;
                }
            });

            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') {
                    col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
                }
            });
        }

        function createCardHtml(deal) {
            const linkVerPedido = deal.UF_CRM_1741349861326;
            // Guardamos os dados do chat e do arquivo no próprio card para uso no modal
            const chatData = encodeURIComponent(JSON.stringify(deal.historicoMensagens));
            const arquivoData = encodeURIComponent(deal.UF_CRM_1748277308731 || '');

            return `
                <div class="kanban-card">
                    <div class="card-title">#${deal.ID} - ${deal.TITLE}</div>
                    <div class="card-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        ${linkVerPedido ? `<a href="${linkVerPedido}" target="_blank" class="btn-acao btn-verificar">Ver Pedido</a>` : ''}
                        <button class="btn-acao" data-action="open-details-modal" data-deal-id="${deal.ID}" data-chat='${chatData}' data-arquivo='${arquivoData}' data-title="${deal.TITLE}">
                            Detalhes Rápidos
                        </button>
                    </div>
                </div>
            `;
        }

        // --- FUNÇÕES DO MODAL ---
        function openDetailsModal(dealId, title, chatData, arquivoData) {
            modalTitle.textContent = `Detalhes do Pedido #${dealId} - ${title}`;
            
            const historicoMensagens = JSON.parse(decodeURIComponent(chatData));
            const linkArquivo = decodeURIComponent(arquivoData);
            
            let chatHtml = '<p class="info-text">Nenhuma mensagem.</p>';
            if(historicoMensagens.length > 0) {
                chatHtml = historicoMensagens.map(msg => {
                    const classe = msg.remetente === 'cliente' ? 'mensagem-cliente' : 'mensagem-designer';
                    const textoLimpo = msg.texto.replace(/^\[Mensagem do Cliente\]\n-+\n/, '');
                    return `<div class="mensagem ${classe}">${textoLimpo}</div>`;
                }).join('');
            }

            let arquivoHtml = '<p class="info-text">Nenhum arquivo finalizado.</p>';
            if(linkArquivo) {
                arquivoHtml = `<a href="${linkArquivo}" target="_blank" class="btn-acao btn-download">Baixar Arquivo</a>`;
            }

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">
                        <div class="card-detalhe">
                            <h3>Conversa com o Designer</h3>
                            <div class="chat-box" style="height: 300px;">
                                <div id="modal-mensagens-container" style="overflow-y: auto; flex-grow: 1; padding-right: 10px;">${chatHtml}</div>
                                <!-- Formulário de envio de mensagem pode ser adicionado aqui -->
                            </div>
                        </div>
                    </div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe">
                            <h3>Arquivos e Verificação</h3>
                            <div id="modal-arquivos-box">${arquivoHtml}</div>
                            <button class="btn-acao btn-verificado" style="width: 100%; margin-top: 15px;">Marcar como Verificado</button>
                        </div>
                    </div>
                </div>
            `;
            modal.classList.add('active');
        }

        // --- EVENT LISTENERS ---
        btnFiltrar.addEventListener('click', carregarPedidosDeProducao);
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });

        // Delegação de eventos para os botões dentro dos cards
        board.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="open-details-modal"]');
            if (button) {
                const { dealId, title, chat, arquivo } = button.dataset;
                openDetailsModal(dealId, title, chat, arquivo);
            }
        });
        
        async function init() {
            // await carregarOpcoesDeFiltro(); // Removido por enquanto para simplificar
            await carregarPedidosDeProducao();
        }

        init();
    });
})();
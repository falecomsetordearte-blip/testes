// /acabamento/acabamento-script.js - VERSÃO VISUAL PREMIUM E SEM ALERTS

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        // --- SEGURANÇA ---
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }

        // --- CONSTANTES ---
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';

        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },   // Vermelho
            '1439': { nome: 'Cliente', cor: '#f1c40f' },    // Amarelo
            '1441': { nome: 'Conferida', cor: '#2ecc71' }   // Verde
        };

        // --- DOM ELEMENTS ---
        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // --- ESTILOS VISUAIS (CSS INLINE MELHORADO) ---
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary: #4a90e2;
                --success: #2ecc71;
                --danger: #e74c3c;
                --text-dark: #2c3e50;
                --text-light: #7f8c8d;
                --bg-card: #ffffff;
                --bg-body: #f4f6f9;
                --shadow-sm: 0 2px 5px rgba(0,0,0,0.05);
                --shadow-md: 0 5px 15px rgba(0,0,0,0.1);
            }

            /* Filters Area */
            .kanban-header { margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
            .filtros-pedidos { display: flex; gap: 10px; }
            .filtros-pedidos select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; font-family: 'Poppins', sans-serif; cursor: pointer; outline: none; transition: border 0.3s; }
            .filtros-pedidos select:focus { border-color: var(--primary); }
            #btn-filtrar { background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
            #btn-filtrar:hover { background: #357abd; }

            /* Kanban Board */
            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; }
            .kanban-column { background: #ebecf0; min-width: 280px; max-width: 320px; border-radius: 10px; padding: 15px; display: flex; flex-direction: column; max-height: 80vh; }
            .column-header { font-weight: 700; color: var(--text-dark); margin-bottom: 15px; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
            .column-cards { overflow-y: auto; flex-grow: 1; padding-right: 5px; scrollbar-width: thin; }
            
            /* Cards Styling */
            .kanban-card { background: var(--bg-card); border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; border-left: 4px solid transparent; cursor: default; position: relative; }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
            
            /* Cores das Bordas baseadas na Coluna (opcional, ajustado via JS ou classes específicas) */
            .status-atrasado .kanban-card { border-left-color: var(--danger); }
            .status-hoje .kanban-card { border-left-color: #f39c12; }
            .status-esta-semana .kanban-card { border-left-color: var(--primary); }
            .status-proxima-semana .kanban-card { border-left-color: #9b59b6; }
            .status-sem-data .kanban-card { border-left-color: #95a5a6; }

            .card-id { font-size: 0.75rem; color: var(--text-light); font-weight: 600; margin-bottom: 5px; }
            .card-client-name { font-size: 0.95rem; font-weight: 600; color: var(--text-dark); margin-bottom: 12px; line-height: 1.4; }
            .btn-detalhes { width: 100%; background: #f1f2f6; border: none; padding: 8px; border-radius: 4px; color: var(--text-dark); font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: background 0.2s; }
            .btn-detalhes:hover { background: #dfe4ea; }

            /* Modal Styling */
            #modal-detalhes-rapidos.modal-overlay { background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); transition: opacity 0.3s; }
            #modal-detalhes-rapidos .modal-content { border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); border: none; padding: 0; overflow: hidden; }
            .modal-header { background: #f8f9fa; padding: 20px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .modal-header h3 { margin: 0; font-size: 1.2rem; color: var(--text-dark); }
            .close-modal { font-size: 1.5rem; color: #aaa; background: none; border: none; cursor: pointer; }
            .modal-body { padding: 25px; background: #fff; }
            
            .detalhe-layout { display: grid; grid-template-columns: 2fr 1.2fr; gap: 25px; }
            .card-detalhe { background: #fff; }
            .card-detalhe h3 { font-size: 1rem; color: var(--text-light); text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #f1f1f1; padding-bottom: 5px; }
            
            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
            .info-item-label { color: var(--text-light); font-weight: 500; font-size: 0.9rem; }
            .info-item-value { font-weight: 600; color: var(--text-dark); text-align: right; }
            
            .modal-actions-container { display: flex; flex-direction: column; gap: 12px; }
            .btn-acao-modal { display: block; width: 100%; padding: 12px; border-radius: 8px; font-weight: 600; text-align: center; cursor: pointer; border: none; font-size: 0.95rem; transition: all 0.2s; text-decoration: none; }
            
            .btn-acao-modal.principal { background-color: var(--success); color: white; box-shadow: 0 4px 6px rgba(46, 204, 113, 0.2); }
            .btn-acao-modal.principal:hover { background-color: #27ae60; transform: translateY(-1px); }
            
            .btn-acao-modal.secundario { background-color: #fff; border: 1px solid #ddd; color: var(--text-dark); }
            .btn-acao-modal.secundario:hover { background-color: #f8f9fa; border-color: #ccc; }

            /* Confirmação no Botão */
            .btn-confirmacao-ativa { background-color: var(--danger) !important; animation: pulse 1s infinite; }
            @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }

            /* Toast Notification System */
            .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; }
            .toast { background: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px; min-width: 300px; animation: slideInRight 0.3s ease-out forwards; border-left: 5px solid #ccc; }
            .toast.success { border-left-color: var(--success); }
            .toast.error { border-left-color: var(--danger); }
            .toast-icon { font-size: 1.2rem; }
            .toast.success .toast-icon { color: var(--success); }
            .toast.error .toast-icon { color: var(--danger); }
            .toast-message { font-size: 0.9rem; color: var(--text-dark); font-weight: 500; }
            
            @keyframes slideInRight { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

            .loading-pedidos { text-align: center; padding: 20px; color: var(--text-light); }
            .spinner { border: 3px solid #f3f3f3; border-top: 3px solid var(--primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);

        // --- SISTEMA DE TOAST (Substituto do Alert) ---
        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
            
            toast.innerHTML = `
                <div class="toast-icon">${icon}</div>
                <div class="toast-message">${message}</div>
            `;
            
            toastContainer.appendChild(toast);

            // Remover após 4 segundos
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.5s forwards';
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        }

        // --- LÓGICA DE DADOS ---
        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                const filters = await response.json();
                if (!response.ok) throw new Error('Falha ao carregar filtros.');
                
                // Limpar antes de adicionar para evitar duplicatas se a função rodar 2x
                impressoraFilterEl.innerHTML = '<option value="">Todas as Impressoras</option>';
                materialFilterEl.innerHTML = '<option value="">Todos os Materiais</option>';

                filters.impressoras.forEach(option => { impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                filters.materiais.forEach(option => { materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
            } catch (error) { 
                console.error(error);
                // Silencioso no filtro, pois não impede a página de carregar
            }
        }

        async function carregarPedidosDeAcabamento() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            
            try {
                const response = await fetch('/api/acabamento/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionToken: sessionToken,
                        impressoraFilter: impressoraFilterEl.value,
                        materialFilter: materialFilterEl.value
                    })
                });
                const data = await response.json();
                
                if (!response.ok) throw new Error(data.message || 'Erro de conexão');
                
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
                
                // Opcional: Feedback discreto de atualização
                // showToast('Pedidos atualizados', 'success'); 

            } catch (error) {
                console.error("Erro ao carregar pedidos:", error);
                document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
                showToast(error.message, 'error');
            }
        }

        function organizarPedidosNasColunas(deals) {
            // Limpa colunas
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            
            const agora = new Date();
            
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                
                if (prazoFinalStr) {
                    const prazoFinal = new Date(prazoFinalStr);
                    if (!isNaN(prazoFinal.getTime())) {
                        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
                        const prazoData = new Date(prazoFinal.getFullYear(), prazoFinal.getMonth(), prazoFinal.getDate());
                        const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) colunaId = 'ATRASADO';
                        else if (diffDays === 0) colunaId = 'HOJE';
                        else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                        else if (diffDays <= 14) colunaId = 'PROXIMA_SEMANA';
                    }
                }
                
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) { coluna.innerHTML += cardHtml; }
            });

            // Mensagem de vazio
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<div style="text-align:center; padding:15px; color:#aaa; font-size:0.9rem; font-style:italic;">Vazio</div>';
            });
        }

        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;

            return `
                <div class="kanban-card" data-deal-id-card="${deal.ID}">
                    <div class="card-id">${displayId}</div>
                    <div class="card-client-name">${nomeCliente}</div>
                    <button class="btn-detalhes" data-action="open-details-modal" data-deal-id="${deal.ID}">
                        <i class="fa-solid fa-eye"></i> Detalhes
                    </button>
                </div>
            `;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            
            modalTitle.textContent = `Pedido #${deal.TITLE || deal.ID}`;
            
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidasId = deal[MEDIDAS_FIELD];
            const medidaInfo = MEDIDAS_MAP[medidasId];
            
            let medidasHtml = '<span style="color:#aaa;">Não definido</span>';
            if (medidaInfo) { 
                medidasHtml = `<span class="tag-medidas" style="background-color: ${medidaInfo.cor}; padding: 2px 8px; border-radius:4px; color:white; font-size:0.85rem;">${medidaInfo.nome}</span>`; 
            }

            let actionsHtml = '';
            if (deal.TITLE) {
                const urlVerPedido = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(deal.TITLE)}`;
                actionsHtml += `<a href="${urlVerPedido}" target="_blank" class="btn-acao-modal secundario"><i class="fa-solid fa-external-link-alt"></i> Ver Pedido Completo</a>`;
            }
            // Botão de ação principal sem alert nativo
            actionsHtml += `<button class="btn-acao-modal principal" data-action="concluir-deal"><i class="fa-solid fa-check"></i> Concluir Etapa</button>`;

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">
                        <div class="card-detalhe">
                             <h3>Informações Principais</h3>
                             <div class="info-item">
                                <span class="info-item-label">Cliente</span>
                                <span class="info-item-value">${nomeCliente}</span>
                             </div>
                             <div class="info-item">
                                <span class="info-item-label">Contato</span>
                                <span class="info-item-value">${contatoCliente}</span>
                             </div>
                             <div class="info-item">
                                <span class="info-item-label">Status Medidas</span>
                                <div class="info-item-value">${medidasHtml}</div>
                             </div>
                        </div>
                    </div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe modal-actions-container">
                            ${actionsHtml}
                        </div>
                    </div>
                </div>
            `;
            
            modal.classList.add('active');
            attachConcluirListener(deal.ID);
        }
        
        // Lógica de confirmação elegante (sem confirm() nativo)
        function attachConcluirListener(dealId) {
            const concluirBtn = modalBody.querySelector('button[data-action="concluir-deal"]');
            if (!concluirBtn) return;

            let confirmationStage = false;

            concluirBtn.addEventListener('click', async () => {
                // Estágio 1: Pedir confirmação visual
                if (!confirmationStage) {
                    confirmationStage = true;
                    concluirBtn.innerHTML = '<i class="fa-solid fa-question-circle"></i> Tem certeza? Clique p/ confirmar';
                    concluirBtn.classList.add('btn-confirmacao-ativa');
                    
                    // Reseta se não confirmar em 4 segundos
                    setTimeout(() => {
                        if (concluirBtn && confirmationStage) { // Verifica se modal ainda está aberto
                            confirmationStage = false;
                            concluirBtn.innerHTML = '<i class="fa-solid fa-check"></i> Concluir Etapa';
                            concluirBtn.classList.remove('btn-confirmacao-ativa');
                        }
                    }, 4000);
                    return;
                }

                // Estágio 2: Executar ação
                concluirBtn.disabled = true;
                concluirBtn.innerHTML = '<div class="spinner" style="width:15px; height:15px; border-width:2px; display:inline-block; vertical-align:middle; margin:0;"></div> Processando...';
                concluirBtn.classList.remove('btn-confirmacao-ativa');

                try {
                    const response = await fetch('/api/acabamento/concluirDeal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionToken: sessionToken,
                            dealId: dealId
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Falha ao concluir o pedido.');
                    }
                    
                    modal.classList.remove('active');
                    showToast(`Pedido concluído! Destino: ${data.destino || 'Definido'}`, 'success');
                    carregarPedidosDeAcabamento();

                } catch (error) {
                    showToast(`Erro: ${error.message}`, 'error');
                    concluirBtn.disabled = false;
                    concluirBtn.innerHTML = '<i class="fa-solid fa-check"></i> Tentar Novamente';
                    confirmationStage = false;
                }
            });
        }
        
        // --- LISTENERS GERAIS ---
        btnFiltrar.addEventListener('click', () => {
            carregarPedidosDeAcabamento();
            showToast('Filtros aplicados', 'success');
        });
        
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        
        modal.addEventListener('click', (e) => { 
            if (e.target === modal) modal.classList.remove('active'); 
        });
        
        board.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="open-details-modal"]');
            if (button) openDetailsModal(button.dataset.dealId);
        });
        
        // Inicialização
        async function init() {
            await carregarOpcoesDeFiltro();
            await carregarPedidosDeAcabamento();
        }
        init();
    });
})();
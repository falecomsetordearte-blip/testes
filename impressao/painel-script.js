// /impressao/painel-script.js - VERSÃO CLEAN (Sem Alertas)

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        const STATUS_IMPRESSAO_FIELD = 'UF_CRM_1757756651931';
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';

        const STATUS_MAP = {
            '2657': { nome: 'Preparação', cor: '#2ecc71', classe: 'preparacao' }, 
            '2659': { nome: 'Na Fila',    cor: '#9b59b6', classe: 'na-fila' }, 
            '2661': { nome: 'Imprimindo', cor: '#e74c3c', classe: 'imprimindo' }, 
            '2663': { nome: 'Pronto',     cor: '#27ae60', classe: 'pronto' }
        };
        const STATUS_ORDER = ['2657', '2659', '2661', '2663'];

        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };

        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // --- ESTILOS VISUAIS CLEAN ---
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary: #4a90e2; --success: #2ecc71; --danger: #e74c3c;
                --text-dark: #2c3e50; --text-light: #7f8c8d; --bg-card: #ffffff;
                --shadow-sm: 0 2px 5px rgba(0,0,0,0.05); --shadow-md: 0 5px 15px rgba(0,0,0,0.15);
            }
            .kanban-header { margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
            .filtros-pedidos { display: flex; gap: 10px; flex-wrap: wrap; }
            .filtros-pedidos select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; font-family: 'Poppins', sans-serif; cursor: pointer; outline: none; transition: border 0.3s; }
            .filtros-pedidos select:focus { border-color: var(--primary); }
            #btn-filtrar { background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
            #btn-filtrar:hover { background: #357abd; }

            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; }
            .kanban-column { background: transparent; min-width: 280px; max-width: 320px; padding: 0; margin-right: 10px; display: flex; flex-direction: column; max-height: 80vh; border: none; box-shadow: none; }
            
            .column-header { font-weight: 700; color: white; margin-bottom: 15px; text-transform: uppercase; font-size: 0.9rem; padding: 10px 15px; border-radius: 6px; text-align: center; box-shadow: var(--shadow-sm); }
            .status-atrasado .column-header { background-color: var(--danger); }
            .status-hoje .column-header { background-color: #f1c40f; color: #333; }
            .status-esta-semana .column-header { background-color: #2980b9; }
            .status-proxima-semana .column-header { background-color: #8e44ad; }
            .status-sem-data .column-header { background-color: #95a5a6; }

            .column-cards { overflow-y: auto; flex-grow: 1; padding-right: 5px; scrollbar-width: thin; }

            .kanban-card { background: var(--bg-card); border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; border-left: 5px solid #ccc; cursor: pointer; position: relative; }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
            .kanban-card.status-preparacao { border-left-color: ${STATUS_MAP['2657'].cor}; }
            .kanban-card.status-na-fila { border-left-color: ${STATUS_MAP['2659'].cor}; }
            .kanban-card.status-imprimindo { border-left-color: ${STATUS_MAP['2661'].cor}; }
            .kanban-card.status-pronto { border-left-color: ${STATUS_MAP['2663'].cor}; }

            .card-id { font-size: 0.75rem; color: var(--text-light); font-weight: 600; margin-bottom: 5px; }
            .card-client-name { font-size: 1rem; font-weight: 600; color: var(--text-dark); margin-bottom: 12px; line-height: 1.4; }
            .card-deadline-tag { display: inline-block; background-color: #f4f6f9; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: var(--text-light); margin-bottom: 10px; }
            
            .btn-detalhes-visual { width: 100%; background: #f4f6f9; border: 1px solid #e1e1e1; padding: 8px; border-radius: 4px; color: var(--text-dark); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 5px; pointer-events: none; }

            #modal-detalhes-rapidos.modal-overlay { background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); transition: opacity 0.3s; }
            #modal-detalhes-rapidos .modal-content { border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); border: none; padding: 0; overflow: hidden; max-width: 900px; width: 95%; }
            .modal-header { background: #f8f9fa; padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .modal-header h3 { margin: 0; font-size: 1.2rem; color: var(--text-dark); }
            .close-modal { font-size: 1.5rem; color: #aaa; background: none; border: none; cursor: pointer; }
            .modal-body { padding: 25px; background: #fff; }

            .steps-container { display: flex; padding: 0 0 20px 0; margin-bottom: 20px; border-bottom: 1px solid #eee; width: 100%; }
            .step { flex: 1; text-align: center; position: relative; color: #aaa; font-weight: 600; font-size: 0.9rem; padding: 12px 5px; background-color: #f8f9fa; border: 1px solid #eee; cursor: pointer; transition: all 0.2s; }
            .step:first-child { border-radius: 6px 0 0 6px; }
            .step:last-child { border-radius: 0 6px 6px 0; }
            .step.completed { background-color: #7f8c8d; color: white; border-color: #7f8c8d; }
            .step.active { z-index: 2; transform: scale(1.05); color: white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            .step.active.preparacao { background-color: ${STATUS_MAP['2657'].cor}; border-color: ${STATUS_MAP['2657'].cor}; }
            .step.active.na-fila { background-color: ${STATUS_MAP['2659'].cor}; border-color: ${STATUS_MAP['2659'].cor}; }
            .step.active.imprimindo { background-color: ${STATUS_MAP['2661'].cor}; border-color: ${STATUS_MAP['2661'].cor}; }
            .step.active.pronto { background-color: ${STATUS_MAP['2663'].cor}; border-color: ${STATUS_MAP['2663'].cor}; }

            .detalhe-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
            .detalhe-col-lateral { display: flex; flex-direction: column; gap: 15px; }
            .card-detalhe { background-color: #fff; border-radius: 8px; padding: 15px; border: 1px solid #eee; }
            .card-detalhe h4 { font-size: 0.9rem; color: var(--text-light); text-transform: uppercase; margin: 0 0 10px 0; border-bottom: 2px solid #f1f1f1; padding-bottom: 5px; }

            .btn-acao-modal { display: block; width: 100%; padding: 10px; border-radius: 6px; font-weight: 600; text-align: center; cursor: pointer; border: none; font-size: 0.9rem; transition: all 0.2s; text-decoration: none; margin-bottom: 8px; }
            .btn-acao-modal.principal { background-color: var(--primary); color: white; }
            .btn-acao-modal.principal:hover { background-color: #357abd; }
            .btn-acao-modal.secundario { background-color: #fff; border: 1px solid #ddd; color: var(--text-dark); }
            .btn-acao-modal.secundario:hover { background-color: #f8f9fa; }

            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 0.9rem; }
            .tag-medidas { padding: 2px 8px; border-radius: 4px; color: white; font-weight: 600; font-size: 0.8rem; }

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

            .loading-pedidos { text-align: center; padding: 20px; color: #aaa; } 
            .spinner { border: 3px solid rgba(74, 144, 226, 0.3); border-top: 3px solid var(--primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);

        // --- SISTEMA DE TOAST ---
        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
            toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-message">${message}</div>`;
            toastContainer.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.5s forwards';
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        }

        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                const filters = await response.json();
                if (!response.ok) throw new Error('Falha ao carregar filtros.');
                impressoraFilterEl.innerHTML = `<option value="">Todas as Impressoras</option>`;
                materialFilterEl.innerHTML = `<option value="">Todos os Materiais</option>`;
                filters.impressoras.forEach(option => { impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                filters.materiais.forEach(option => { materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
            } catch (error) { 
                console.error("Erro ao carregar opções de filtro:", error); 
                showToast("Erro ao carregar filtros", "error");
            }
        }

        async function carregarPedidosDeImpressao() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            try {
                const response = await fetch('/api/impressao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionToken: sessionToken,
                        impressoraFilter: impressoraFilterEl.value,
                        materialFilter: materialFilterEl.value
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
            } catch (error) {
                console.error("Erro ao carregar pedidos de impressão:", error);
                document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div style="text-align:center;color:#ccc;padding:10px;">Erro ao carregar</div>');
                showToast(error.message || "Erro na conexão", 'error');
            }
        }

        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            const agora = new Date();
            const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const dateParts = prazoFinalStr.split('T')[0].split('-');
                    if (dateParts.length === 3) {
                        const ano = parseInt(dateParts[0], 10);
                        const mes = parseInt(dateParts[1], 10) - 1;
                        const dia = parseInt(dateParts[2], 10);
                        const prazoData = new Date(ano, mes, dia);
                        if (!isNaN(prazoData.getTime())) {
                            const diffTime = prazoData.getTime() - hoje.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) colunaId = 'ATRASADO';
                            else if (diffDays === 0) colunaId = 'HOJE';
                            else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                            else colunaId = 'PROXIMA_SEMANA';
                        }
                    }
                }
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) coluna.innerHTML += cardHtml;
            });

            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<div style="text-align:center; padding:15px; color:#ccc; font-size:0.85rem;">Vazio</div>';
            });
        }
        
        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            const statusId = deal[STATUS_IMPRESSAO_FIELD];
            const statusInfo = STATUS_MAP[statusId] || {};
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            
            let prazoTagHtml = '';
            const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
            if (prazoFinalStr) {
                const dataFormatada = new Date(prazoFinalStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                prazoTagHtml = `<div class="card-deadline-tag"><i class="far fa-clock"></i> ${dataFormatada}</div>`;
            }

            return `
                <div class="kanban-card ${statusInfo.classe ? 'status-' + statusInfo.classe : ''}" data-deal-id-card="${deal.ID}">
                    <div class="card-id">${displayId}</div>
                    <div class="card-client-name">${nomeCliente}</div>
                    ${prazoTagHtml}
                    <div class="btn-detalhes-visual">
                        <i class="fa-solid fa-eye"></i> Visualizar
                    </div>
                </div>
            `;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            
            modalTitle.textContent = `Impressão #${deal.TITLE || deal.ID}`;
            
            const statusAtualId = deal[STATUS_IMPRESSAO_FIELD] || STATUS_ORDER[0];
            const statusAtualIndex = STATUS_ORDER.indexOf(statusAtualId);
            let stepsHtml = '';
            STATUS_ORDER.forEach((id, index) => {
                const status = STATUS_MAP[id];
                let stepClass = 'step';
                if (index < statusAtualIndex) stepClass += ' completed';
                else if (index === statusAtualIndex) stepClass += ' active ' + status.classe;
                stepsHtml += `<div class="${stepClass}" data-status-id="${id}">${status.nome}</div>`;
            });

            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidasId = deal[MEDIDAS_FIELD];
            const medidaInfo = MEDIDAS_MAP[medidasId];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '<span style="color:#aaa">Não def.</span>';
            const linkArquivo = deal[LINK_ARQUIVO_FINAL_FIELD];
            const linkAtendimento = deal[LINK_ATENDIMENTO_FIELD];

            let actionsHtml = '';
            if (linkArquivo) { actionsHtml += `<a href="${linkArquivo}" target="_blank" class="btn-acao-modal principal"><i class="fas fa-download"></i> Baixar Arquivo</a>`; }
            if (linkAtendimento) { actionsHtml += `<a href="${linkAtendimento}" target="_blank" class="btn-acao-modal secundario"><i class="fab fa-whatsapp"></i> Ver Atendimento</a>`; }
            if (deal.TITLE) {
                const urlVerPedido = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(deal.TITLE)}`;
                actionsHtml += `<a href="${urlVerPedido}" target="_blank" class="btn-acao-modal secundario"><i class="fa-solid fa-external-link-alt"></i> Ver Pedido</a>`;
            }
            if (actionsHtml === '') { actionsHtml = '<p style="text-align:center; color:#999; font-size:0.8rem;">Sem ações disponíveis</p>'; }
            
            const mainColumnHtml = `
                <div class="card-detalhe" style="text-align: center; color: #aaa; padding: 50px 20px; border: 2px dashed #eee; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                    <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.3;"></i>
                    <h3 style="margin: 0 0 10px 0; color: var(--text-dark);">Chat de Revisão</h3>
                    <p style="font-size: 0.9rem;">Funcionalidade em desenvolvimento</p>
                </div>
            `;

            modalBody.innerHTML = `
                <div class="steps-container">${stepsHtml}</div>
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">${mainColumnHtml}</div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe">
                             <h4>Dados do Cliente</h4>
                            <div class="info-item"><span>Nome:</span><span>${nomeCliente}</span></div>
                            <div class="info-item"><span>Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span>Medidas:</span>${medidasHtml}</div>
                        </div>

                        <div class="card-detalhe">
                            <h4>Ações</h4>
                            ${actionsHtml}
                        </div>
                    </div>
                </div>`;
            
            modal.classList.add('active');
            attachStatusStepListeners(deal.ID);
        }

        function attachStatusStepListeners(dealId) {
            const container = document.querySelector('.steps-container');
            if(!container) return;

            container.addEventListener('click', (event) => {
                const step = event.target.closest('.step');
                if (!step) return;
                
                const newStatusId = step.dataset.statusId;
                const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                if (dealIndex === -1) return;
                
                const oldStatusId = allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD];
                if (newStatusId === oldStatusId) return;

                updateVisualStatus(dealId, newStatusId);
                allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD] = newStatusId;

                fetch('/api/impressao/updateStatus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dealId, statusId: newStatusId })
                })
                .then(response => {
                    if (!response.ok) return response.json().then(err => { throw new Error(err.message || 'Erro do servidor') });
                    return response.json();
                })
                .then(data => {
                    showToast(`Status atualizado para: ${STATUS_MAP[newStatusId].nome}`, 'success');
                    if (data.movedToNextStage) {
                        setTimeout(() => {
                            modal.classList.remove('active');
                            carregarPedidosDeImpressao();
                        }, 500);
                    }
                })
                .catch(error => {
                    // Substituição do Alert por Toast
                    showToast('Erro ao atualizar status. Revertendo...', 'error');
                    updateVisualStatus(dealId, oldStatusId);
                    allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD] = oldStatusId;
                });
            });
        }

        function updateVisualStatus(dealId, newStatusId) {
            const stepsContainer = document.querySelector('.steps-container');
            if (stepsContainer && document.getElementById('modal-detalhes-rapidos').classList.contains('active')) {
                const steps = stepsContainer.querySelectorAll('.step');
                const newStatusIndex = STATUS_ORDER.indexOf(newStatusId);
                steps.forEach((s, index) => {
                    const currentStatusId = s.dataset.statusId;
                    const statusInfo = STATUS_MAP[currentStatusId];
                    s.className = 'step';
                    if (index < newStatusIndex) s.classList.add('completed');
                    else if (index === newStatusIndex) s.classList.add('active', statusInfo.classe);
                });
            }
            
            const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
            if (card) {
                Object.values(STATUS_MAP).forEach(info => card.classList.remove('status-' + info.classe));
                const newStatusInfo = STATUS_MAP[newStatusId];
                if (newStatusInfo) card.classList.add('status-' + newStatusInfo.classe);
            }
        }
        
        btnFiltrar.addEventListener('click', () => {
            carregarPedidosDeImpressao();
            showToast('Filtros aplicados', 'success');
        });

        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

        board.addEventListener('click', (event) => {
            const card = event.target.closest('.kanban-card');
            if (card) {
                const dealId = card.dataset.dealIdCard;
                if (dealId) openDetailsModal(dealId);
            }
        });
        
        async function init() {
            await carregarOpcoesDeFiltro();
            await carregarPedidosDeImpressao();
        }
        init();
    });
})();
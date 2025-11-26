// /instalacao/painel-script.js - VERSÃO CLEAN (VISUAL ACABAMENTO)

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        // --- SEGURANÇA ---
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        // --- CONSTANTES & CAMPOS ---
        const LAYOUT_FIELD = 'UF_CRM_1764124589418'; // Link do Layout
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';
        
        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };

        // --- DOM ELEMENTS ---
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // --- ESTILOS VISUAIS (BASEADO NO ACABAMENTO - TEMA AZUL) ---
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary: #3498db; /* Azul Instalação Externa */
                --success: #2ecc71;
                --danger: #e74c3c;
                --text-dark: #2c3e50;
                --text-light: #7f8c8d;
                --bg-card: #ffffff;
                --shadow-sm: 0 2px 5px rgba(0,0,0,0.05);
                --shadow-md: 0 5px 15px rgba(0,0,0,0.15);
            }

            /* Kanban Board */
            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; }
            .kanban-column { 
                background: transparent; 
                min-width: 280px; max-width: 320px; 
                padding: 0; margin-right: 10px; 
                display: flex; flex-direction: column; 
                max-height: 80vh; border: none; box-shadow: none;
            }

            /* Header da Coluna */
            .column-header { 
                font-weight: 700; color: white; margin-bottom: 15px; 
                text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.5px; 
                padding: 10px 15px; border-radius: 6px; text-align: center; box-shadow: var(--shadow-sm);
            }
            .status-atrasado .column-header { background-color: var(--danger); }
            .status-hoje .column-header { background-color: #f1c40f; color: #333; }
            .status-esta-semana .column-header { background-color: #2980b9; }
            .status-proxima-semana .column-header { background-color: #8e44ad; }
            .status-sem-data .column-header { background-color: #95a5a6; }

            .column-cards { overflow-y: auto; flex-grow: 1; padding-right: 5px; scrollbar-width: thin; }
            
            /* Cards Styling */
            .kanban-card { 
                background: var(--bg-card); border-radius: 8px; padding: 15px; margin-bottom: 12px; 
                box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; 
                border-left: 5px solid var(--primary); /* Azul Padrão */
                cursor: default; position: relative; 
            }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
            
            .card-id { font-size: 0.75rem; color: var(--text-light); font-weight: 600; margin-bottom: 5px; }
            .card-client-name { font-size: 1rem; font-weight: 600; color: var(--text-dark); margin-bottom: 12px; line-height: 1.4; }
            .card-deadline-tag { display: inline-block; background-color: #f4f6f9; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: var(--text-light); margin-bottom: 10px; }

            .btn-detalhes { 
                width: 100%; background: #f4f6f9; border: 1px solid #e1e1e1; padding: 8px; 
                border-radius: 4px; color: var(--text-dark); font-weight: 600; font-size: 0.85rem; 
                cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px;
            }
            .btn-detalhes:hover { background: #e2e6ea; }

            /* Modal Styling */
            #modal-detalhes-rapidos.modal-overlay { background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); transition: opacity 0.3s; }
            #modal-detalhes-rapidos .modal-content { border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); border: none; padding: 0; overflow: hidden; max-width: 900px; width: 95%; }
            .modal-header { background: #f8f9fa; padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .modal-header h3 { margin: 0; font-size: 1.2rem; color: var(--text-dark); }
            .close-modal { font-size: 1.5rem; color: #aaa; background: none; border: none; cursor: pointer; }
            .modal-body { padding: 25px; background: #fff; }
            
            /* Layout Dividido do Modal (Imagem Esq / Info Dir) */
            .detalhe-layout { display: grid; grid-template-columns: 60% 38%; gap: 2%; min-height: 400px; }
            
            .detalhe-col-principal { 
                background-color: #f8f9fa; border-radius: 8px; border: 2px dashed #dee2e6;
                display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; padding: 5px;
            }
            .layout-img { max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in; box-shadow: var(--shadow-sm); border-radius: 4px; }
            .sem-imagem { text-align: center; color: #aaa; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .sem-imagem i { font-size: 3rem; margin-bottom: 10px; opacity: 0.5; }

            .detalhe-col-lateral { display: flex; flex-direction: column; gap: 15px; }
            .card-detalhe { background: #fff; }
            .card-detalhe h4 { font-size: 0.9rem; color: var(--text-light); text-transform: uppercase; margin: 0 0 10px 0; border-bottom: 2px solid #f1f1f1; padding-bottom: 5px; }

            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 0.9rem; }
            .tag-medidas { padding: 2px 8px; border-radius: 4px; color: white; font-weight: 600; font-size: 0.8rem; }
            
            .btn-acao-modal { 
                display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px; 
                border-radius: 6px; font-weight: 600; text-align: center; cursor: pointer; border: none; 
                font-size: 0.9rem; transition: all 0.2s; text-decoration: none; margin-bottom: 8px;
            }
            .btn-acao-modal.principal { background-color: var(--primary); color: white; }
            .btn-acao-modal.principal:hover { background-color: #2980b9; }
            .btn-acao-modal.secundario { background-color: #fff; border: 1px solid #ddd; color: var(--text-dark); }
            .btn-acao-modal.secundario:hover { background-color: #f8f9fa; border-color: #bbb; }

            /* Botão Concluir (Destaque) */
            .btn-concluir { 
                background-color: var(--success); color: white; font-size: 1rem; padding: 15px; 
                border: none; border-radius: 8px; font-weight: 700; width: 100%; cursor: pointer; 
                transition: all 0.2s; box-shadow: 0 4px 6px rgba(46, 204, 113, 0.25);
                display: flex; align-items: center; justify-content: center; gap: 8px;
            }
            .btn-concluir:hover { background-color: #27ae60; transform: translateY(-2px); }

            /* Confirmação Ativa (Piscando) */
            .btn-confirmacao-ativa { background-color: var(--danger) !important; animation: pulse 1s infinite; }
            @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }

            /* Toast Notification */
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
            .spinner { border: 3px solid rgba(52, 152, 219, 0.3); border-top: 3px solid var(--primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            @media (max-width: 768px) {
                .detalhe-layout { grid-template-columns: 1fr; gap: 20px; }
                .detalhe-col-principal { min-height: 250px; }
            }
        `;
        document.head.appendChild(style);

        // --- SISTEMA DE TOAST (Substitui alerts) ---
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

        // --- HELPER: IMAGENS GOOGLE DRIVE ---
        function processarLinkImagem(url) {
            if (!url) return null;
            if (url.includes('drive.google.com')) {
                const idMatch = url.match(/\/d\/(.*?)\/|\/d\/(.*)$|id=(.*?)$/);
                const fileId = idMatch ? (idMatch[1] || idMatch[2] || idMatch[3]) : null;
                if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
            }
            if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('googleusercontent')) return url;
            return url;
        }

        // --- LÓGICA DE DADOS ---
        async function carregarPedidos() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            try {
                const response = await fetch('/api/instalacao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: sessionToken })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
            } catch (error) {
                console.error("Erro:", error);
                document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div style="text-align:center;color:#ccc;padding:10px;">Erro ao carregar</div>');
                showToast(error.message, 'error');
            }
        }

        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const prazoData = new Date(prazoFinalStr.split('T')[0]);
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else colunaId = 'PROXIMA_SEMANA';
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
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            
            let prazoTagHtml = '';
            if (deal[PRAZO_FINAL_FIELD]) {
                const dataFormatada = new Date(deal[PRAZO_FINAL_FIELD]).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                prazoTagHtml = `<div class="card-deadline-tag"><i class="far fa-clock"></i> ${dataFormatada}</div>`;
            }

            return `
                <div class="kanban-card" data-deal-id-card="${deal.ID}">
                    <div class="card-id">${displayId}</div>
                    <div class="card-client-name">${nomeCliente}</div>
                    ${prazoTagHtml}
                    <button class="btn-detalhes" data-action="open-details-modal" data-deal-id="${deal.ID}">
                        <i class="fa-solid fa-eye"></i> Visualizar
                    </button>
                </div>`;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            
            modalTitle.textContent = `Instalação Externa #${deal.TITLE || deal.ID}`;
            
            // Dados
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidaInfo = MEDIDAS_MAP[deal[MEDIDAS_FIELD]];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '<span style="color:#aaa">Não def.</span>';
            
            // Imagem
            const rawLink = deal[LAYOUT_FIELD];
            const imageSrc = processarLinkImagem(rawLink);
            let imageHtml = '';
            if (imageSrc) {
                imageHtml = `
                    <a href="${rawLink}" target="_blank" title="Clique para abrir original">
                        <img src="${imageSrc}" class="layout-img" alt="Layout" 
                        onerror="this.onerror=null; this.parentElement.parentElement.innerHTML='<div class=sem-imagem><i class=\\'fas fa-link\\'></i><p>Erro visualização</p><a href=\\'${rawLink}\\' target=\\'_blank\\' class=\\'btn-acao-modal secundario\\'>Abrir Link</a></div>'">
                    </a>`;
            } else {
                imageHtml = `<div class="sem-imagem"><i class="fas fa-image"></i><p>Sem layout anexado</p></div>`;
            }

            // Links Extras
            let linksHtml = '';
            if(deal[LINK_ARQUIVO_FINAL_FIELD]) linksHtml += `<a href="${deal[LINK_ARQUIVO_FINAL_FIELD]}" target="_blank" class="btn-acao-modal principal"><i class="fas fa-download"></i> Baixar Arquivo</a>`;
            if(deal[LINK_ATENDIMENTO_FIELD]) linksHtml += `<a href="${deal[LINK_ATENDIMENTO_FIELD]}" target="_blank" class="btn-acao-modal secundario"><i class="fab fa-whatsapp"></i> Ver Atendimento</a>`;

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <!-- Esquerda: Imagem -->
                    <div class="detalhe-col-principal">
                       ${imageHtml}
                    </div>

                    <!-- Direita: Ação e Dados -->
                    <div class="detalhe-col-lateral">
                        <button id="btn-concluir-action" class="btn-concluir">
                            <i class="fas fa-check-circle"></i> Instalação Realizada
                        </button>

                        <div class="card-detalhe">
                            <h4>Cliente</h4>
                            <div class="info-item"><span>Nome:</span><strong>${nomeCliente}</strong></div>
                            <div class="info-item"><span>Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span>Medidas:</span>${medidasHtml}</div>
                        </div>

                        <div class="card-detalhe">
                            <h4>Arquivos</h4>
                            ${linksHtml || '<p style="text-align:center; color:#999; font-size:0.8rem;">Nenhum link extra</p>'}
                        </div>
                    </div>
                </div>`;
            
            modal.classList.add('active');
            attachConcluirListener(deal.ID);
        }

        // Lógica de Confirmação (Anti-Alert)
        function attachConcluirListener(dealId) {
            const btn = document.getElementById('btn-concluir-action');
            if(!btn) return;

            let confirmationStage = false;

            btn.addEventListener('click', async () => {
                if (!confirmationStage) {
                    // Estágio 1: Pedir confirmação
                    confirmationStage = true;
                    btn.innerHTML = '<i class="fa-solid fa-question-circle"></i> Tem certeza? Clique p/ confirmar';
                    btn.classList.add('btn-confirmacao-ativa');
                    
                    // Reseta se não confirmar em 4s
                    setTimeout(() => {
                        if (btn && confirmationStage) {
                            confirmationStage = false;
                            btn.innerHTML = '<i class="fas fa-check-circle"></i> Instalação Realizada';
                            btn.classList.remove('btn-confirmacao-ativa');
                        }
                    }, 4000);
                    return;
                }

                // Estágio 2: Executar
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner" style="width:15px; height:15px; border-width:2px; display:inline-block; vertical-align:middle; margin:0; border-top-color:#fff;"></div> Processando...';
                btn.classList.remove('btn-confirmacao-ativa');

                try {
                    const response = await fetch('/api/instalacao/concluir', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionToken: sessionToken, dealId: dealId })
                    });
                    
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);

                    modal.classList.remove('active');
                    showToast('Instalação concluída com sucesso!', 'success');
                    
                    // Remove card visualmente
                    const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
                    if(card) {
                        card.style.transition = 'opacity 0.5s';
                        card.style.opacity = '0';
                        setTimeout(() => card.remove(), 500);
                    }
                } catch (error) {
                    showToast(`Erro: ${error.message}`, 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-check-circle"></i> Tentar Novamente';
                    confirmationStage = false;
                }
            });
        }

        // --- EVENT LISTENERS GERAIS ---
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        
        board.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="open-details-modal"]');
            if (button) openDetailsModal(button.dataset.dealId);
        });
        
        carregarPedidos();
    });
})();
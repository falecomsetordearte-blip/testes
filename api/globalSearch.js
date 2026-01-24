// globalSearch.js - Sistema de Busca Centralizado

document.addEventListener("DOMContentLoaded", () => {
    inicializarBuscaGlobal();
});

function inicializarBuscaGlobal() {
    // 1. CSS + HTML DO MODAL
    // Injetamos diretamente para garantir que exista e tenha o z-index correto
    const modalHTML = `
    <style>
        .spotlight-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
            z-index: 999999; /* ACIMA DE TUDO */
            display: none; justify-content: center; align-items: flex-start;
            padding-top: 10vh; opacity: 0; transition: opacity 0.2s ease;
        }
        .spotlight-overlay.active { display: flex; opacity: 1; }
        
        .spotlight-container {
            width: 650px; max-width: 90%; background: white; border-radius: 12px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            overflow: hidden; display: flex; flex-direction: column;
            transform: scale(0.95); transition: transform 0.2s ease;
        }
        .spotlight-overlay.active .spotlight-container { transform: scale(1); }
        
        .spotlight-header { padding: 20px 25px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; background: #fff; }
        .spotlight-input { width: 100%; font-size: 1.2rem; border: none; outline: none; color: #334155; margin-left: 15px; font-weight: 500; font-family: inherit; }
        
        .spotlight-results { max-height: 60vh; overflow-y: auto; padding: 0; background: #fcfcfc; }
        
        .spotlight-item { padding: 15px 25px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.1s; }
        .spotlight-item:hover { background: #e0f2fe; }
        
        .sp-badge { font-size: 0.75rem; font-weight: 700; color: white; padding: 5px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .sp-spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .sp-footer { padding: 10px 25px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; display: flex; justify-content: space-between; }
    </style>

    <div id="spotlight-overlay" class="spotlight-overlay">
        <div class="spotlight-container">
            <div class="spotlight-header">
                <i class="fas fa-search" style="color: #94a3b8; font-size: 1.4rem;"></i>
                <input type="text" id="spotlight-input" class="spotlight-input" placeholder="O que você procura?" autocomplete="off">
                <div id="spotlight-spinner" class="sp-spinner"></div>
            </div>
            <div id="spotlight-results" class="spotlight-results">
                <div style="padding:50px; text-align:center; color:#cbd5e1;">
                    <i class="fas fa-keyboard" style="font-size: 2rem; margin-bottom: 10px; display:block;"></i>
                    Digite para pesquisar em todos os setores
                </div>
            </div>
            <div class="sp-footer">
                <span>Use <b>ESC</b> para fechar</span>
                <span>Setor de Arte v2.0</span>
            </div>
        </div>
    </div>`;

    // Injeta no final do body se não existir
    if (!document.getElementById('spotlight-overlay')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 2. CONTROLES DO MODAL
    const overlay = document.getElementById('spotlight-overlay');
    const input = document.getElementById('spotlight-input');
    const resultsDiv = document.getElementById('spotlight-results');
    const spinner = document.getElementById('spotlight-spinner');
    let debounceTimeout = null;

    // Função de Abrir
    window.abrirBuscaGlobal = function() {
        overlay.classList.add('active');
        // Pequeno delay para garantir foco
        setTimeout(() => input.focus(), 50);
    };

    // Função de Fechar
    window.fecharBuscaGlobal = function() {
        overlay.classList.remove('active');
        input.value = '';
        setTimeout(() => {
            resultsDiv.innerHTML = '<div style="padding:50px; text-align:center; color:#cbd5e1;"><i class="fas fa-keyboard" style="font-size: 2rem; margin-bottom: 10px; display:block;"></i>Digite para pesquisar em todos os setores</div>';
        }, 200);
    };

    // 3. ESCUTAR CLIQUES GLOBAIS (Delegação de Eventos)
    document.addEventListener('click', (e) => {
        // Se clicar no botão do Header (que pode ter carregado depois)
        if (e.target.closest('#btn-open-search')) {
            window.abrirBuscaGlobal();
        }
        
        // Se clicar no fundo escuro do modal (para fechar)
        if (e.target.id === 'spotlight-overlay') {
            window.fecharBuscaGlobal();
        }

        // Logout
        if (e.target.closest('#logout-button')) {
            localStorage.removeItem('sessionToken');
            window.location.href = '/login.html';
        }
    });

    // 4. ATALHOS DE TECLADO
    document.addEventListener('keydown', (e) => {
        // Ctrl + K ou Cmd + K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault(); // Evita o atalho do navegador
            window.abrirBuscaGlobal();
        }
        // ESC
        if (e.key === 'Escape') {
            window.fecharBuscaGlobal();
        }
    });

    // 5. LÓGICA DE DIGITAÇÃO (LIVE SEARCH)
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimeout);

        if (query.length === 0) {
            resultsDiv.innerHTML = '<div style="padding:50px; text-align:center; color:#cbd5e1;">Digite para pesquisar...</div>';
            spinner.style.display = 'none';
            return;
        }

        spinner.style.display = 'block';

        debounceTimeout = setTimeout(async () => {
            try {
                const sessionToken = localStorage.getItem('sessionToken');
                const res = await fetch('/api/searchDeal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken, query })
                });
                
                const data = await res.json();
                renderResults(data.results);
            } catch (err) {
                console.error(err);
                resultsDiv.innerHTML = '<div style="padding:20px; color:#ef4444; text-align:center;">Erro ao conectar com servidor.</div>';
            } finally {
                spinner.style.display = 'none';
            }
        }, 500); // Espera 500ms
    });

    // 6. RENDERIZAÇÃO
    function renderResults(list) {
        resultsDiv.innerHTML = '';
        
        if (!list || list.length === 0) {
            resultsDiv.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">Nenhum pedido encontrado com esse termo.</div>';
            return;
        }

        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'spotlight-item';
            
            const valor = item.valor ? parseFloat(item.valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';
            const dataCriacao = item.data ? new Date(item.data).toLocaleDateString('pt-BR') : 'Data N/D';

            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span style="font-weight:600; font-size:1rem; color:#1e293b;">#${item.id} - ${item.titulo}</span>
                    <span style="font-size:0.8rem; color:#64748b;">Criado em ${dataCriacao} • ${valor}</span>
                </div>
                <div>
                    <span class="sp-badge" style="background-color: ${item.cor_setor}">${item.setor}</span>
                </div>
            `;
            
            div.onclick = () => {
                window.fecharBuscaGlobal();
                
                // ROTEAMENTO DE CLIQUE
                if(item.setor.includes('CRM')) window.location.href = '/crm.html';
                else if(item.setor.includes('ARTE')) window.location.href = '/painel.html';
                else if(item.setor.includes('ACABAMENTO') || item.setor.includes('IMPRESSÃO')) window.location.href = '/acabamento/acabamento.html';
                else if(item.setor.includes('EXPEDIÇÃO')) window.location.href = '/expedicao/index.html';
                else if(item.setor.includes('INSTALAÇÃO')) window.location.href = '/instalacao/painel.html';
                else {
                    // Fallback
                    alert(`Abrindo detalhes do pedido #${item.id}`);
                }
            };

            resultsDiv.appendChild(div);
        });
    }
}
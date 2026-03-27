// globalSearch.js - Sistema de Busca Centralizado (Neon DB)

window.inicializarBuscaGlobal = function() {
    console.log("[GlobalSearch] Inicializando DOM do modal de busca...");
    // 1. CSS + HTML DO MODAL
    const modalHTML = `
    <style>
        .spotlight-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px);
            z-index: 999999; /* ACIMA DE TUDO */
            display: none; justify-content: center; align-items: flex-start;
            padding-top: 10vh; opacity: 0; transition: opacity 0.2s ease;
        }
        .spotlight-overlay.active { display: flex; opacity: 1; }
        
        .spotlight-container {
            width: 700px; max-width: 95%; background: white; border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            overflow: hidden; display: flex; flex-direction: column;
            transform: scale(0.95); transition: transform 0.2s ease;
            border: 1px solid rgba(0,0,0,0.1);
        }
        .spotlight-overlay.active .spotlight-container { transform: scale(1); }
        
        .spotlight-header { padding: 20px 25px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; background: #fff; }
        .spotlight-input { width: 100%; font-size: 1.3rem; border: none; outline: none; color: #1e293b; margin-left: 15px; font-weight: 500; font-family: 'Poppins', sans-serif; }
        .spotlight-input::placeholder { color: #94a3b8; font-weight: 400; }
        
        .spotlight-results { max-height: 60vh; overflow-y: auto; padding: 0; background: #f8fafc; }
        
        .spotlight-item { padding: 18px 25px; border-bottom: 1px solid #e2e8f0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s; background: #fff; }
        .spotlight-item:hover { background: #f1f5f9; }
        
        .sp-badge { font-size: 0.7rem; font-weight: 700; color: white; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        
        .sp-info { display: flex; flex-direction: column; gap: 6px; }
        .sp-title { font-weight: 700; font-size: 1.05rem; color: #0f172a; display: flex; align-items: center; gap: 8px; }
        .sp-subtitle { font-size: 0.85rem; color: #64748b; display: flex; align-items: center; gap: 15px; }
        .sp-subtitle i { color: #94a3b8; }
        
        .sp-spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .sp-footer { padding: 12px 25px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
        .sp-key { background: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem; color: #475569;}
    </style>

    <div id="spotlight-overlay" class="spotlight-overlay">
        <div class="spotlight-container">
            <div class="spotlight-header">
                <i class="fas fa-search" style="color: #64748b; font-size: 1.5rem;"></i>
                <input type="text" id="spotlight-input" class="spotlight-input" placeholder="Busque por pedido, cliente, telefone ou ID..." autocomplete="off">
                <div id="spotlight-spinner" class="sp-spinner"></div>
            </div>
            <div id="spotlight-results" class="spotlight-results">
                <div style="padding:60px; text-align:center; color:#94a3b8;">
                    <i class="fas fa-satellite-dish" style="font-size: 2.5rem; margin-bottom: 15px; display:block; opacity: 0.5;"></i>
                    Digite algo para buscar no banco de dados.
                </div>
            </div>
            <div class="sp-footer">
                <span>Pressione <span class="sp-key">ESC</span> para fechar</span>
                <span style="font-weight: 600; color: #3b82f6;">Busca Global <i class="fas fa-bolt"></i></span>
            </div>
        </div>
    </div>`;

    if (!document.getElementById('spotlight-overlay')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 2. CONTROLES DO MODAL
    const overlay = document.getElementById('spotlight-overlay');
    const input = document.getElementById('spotlight-input');
    const resultsDiv = document.getElementById('spotlight-results');
    const spinner = document.getElementById('spotlight-spinner');
    let debounceTimeout = null;

    window.abrirBuscaGlobal = function() {
        console.log("[GlobalSearch] Abrindo modal de busca...");
        overlay.classList.add('active');
        setTimeout(() => input.focus(), 50);
    };

    window.fecharBuscaGlobal = function() {
        console.log("[GlobalSearch] Fechando modal de busca...");
        overlay.classList.remove('active');
        input.value = '';
        setTimeout(() => {
            resultsDiv.innerHTML = `
                <div style="padding:60px; text-align:center; color:#94a3b8;">
                    <i class="fas fa-satellite-dish" style="font-size: 2.5rem; margin-bottom: 15px; display:block; opacity: 0.5;"></i>
                    Digite algo para buscar no banco de dados.
                </div>`;
        }, 200);
    };

    // 3. ESCUTAR CLIQUES GLOBAIS
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-open-search')) {
            window.abrirBuscaGlobal();
        }
        
        if (e.target.id === 'spotlight-overlay') {
            window.fecharBuscaGlobal();
        }
    });

    // 4. ATALHOS DE TECLADO
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault(); 
            window.abrirBuscaGlobal();
        }
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            window.fecharBuscaGlobal();
        }
    });

    // 5. LÓGICA DE DIGITAÇÃO E FETCH (API NEON)
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimeout);

        if (query.length < 2) { // Evita buscar com 1 letra só para não sobrecarregar
            if (query.length === 0) {
                resultsDiv.innerHTML = `
                    <div style="padding:60px; text-align:center; color:#94a3b8;">
                        <i class="fas fa-satellite-dish" style="font-size: 2.5rem; margin-bottom: 15px; display:block; opacity: 0.5;"></i>
                        Digite algo para buscar no banco de dados.
                    </div>`;
            }
            spinner.style.display = 'none';
            return;
        }

        console.log(`[GlobalSearch] Iniciando busca por: "${query}"...`);
        spinner.style.display = 'block';

        debounceTimeout = setTimeout(async () => {
            try {
                const sessionToken = localStorage.getItem('sessionToken');
                const res = await fetch('/api/searchDeal', { // A Rota é a mesma, mas o backend mudou
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken, query })
                });
                
                if(!res.ok) throw new Error("Erro na resposta do servidor");

                const data = await res.json();
                console.log(`[GlobalSearch] Resultados recebidos:`, data.results);
                renderResults(data.results);
            } catch (err) {
                console.error("[GlobalSearch] Erro ao buscar:", err);
                resultsDiv.innerHTML = '<div style="padding:40px; color:#ef4444; text-align:center; font-weight:600;"><i class="fas fa-exclamation-triangle" style="font-size:2rem; display:block; margin-bottom:10px;"></i>Erro ao conectar com o banco de dados.</div>';
            } finally {
                spinner.style.display = 'none';
            }
        }, 600); 
    });

    // 6. RENDERIZAÇÃO INTELIGENTE
    function renderResults(list) {
        resultsDiv.innerHTML = '';
        
        if (!list || list.length === 0) {
            resultsDiv.innerHTML = '<div style="padding:50px; text-align:center; color:#64748b; font-weight:500;"><i class="fas fa-search-minus" style="font-size:2rem; display:block; margin-bottom:10px; opacity:0.5;"></i>Nenhum pedido ou cliente encontrado com esse termo.</div>';
            return;
        }

        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'spotlight-item';
            
            // Formatadores
            const dataCriacao = item.data ? new Date(item.data).toLocaleDateString('pt-BR') : 'Data N/D';
            const nomeCliente = item.nome_cliente || 'Sem Nome';
            const telCliente = item.telefone || 'Sem telefone';
            const tituloPedido = item.titulo || `Pedido #${item.id}`;

            div.innerHTML = `
                <div class="sp-info">
                    <span class="sp-title">
                        <i class="fas fa-file-invoice" style="color: #3b82f6;"></i> ${tituloPedido}
                        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: normal;">(ID: ${item.id})</span>
                    </span>
                    <span class="sp-subtitle">
                        <span><i class="fas fa-user"></i> ${nomeCliente}</span>
                        <span><i class="fab fa-whatsapp" style="color: #22c55e;"></i> ${telCliente}</span>
                        <span><i class="far fa-calendar-alt"></i> ${dataCriacao}</span>
                    </span>
                </div>
                <div>
                    <span class="sp-badge" style="background-color: ${item.cor_setor}">${item.setor}</span>
                </div>
            `;
            
            div.onclick = () => {
                window.fecharBuscaGlobal();
                console.log(`[GlobalSearch] Redirecionando para o setor: ${item.modulo_destino}`);
                
                // Roteamento inteligente baseado na resposta do backend
                if(item.modulo_destino) {
                    window.location.href = item.modulo_destino;
                } else {
                    alert(`Não foi possível determinar a página para o pedido #${item.id}`);
                }
            };

            resultsDiv.appendChild(div);
        });
    }
}
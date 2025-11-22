// ============================================================
// SCRIPT.JS - PARTE 1: AUTENTICAÇÃO E INICIALIZAÇÃO
// ============================================================

// --- Funções Auxiliares de Erro e Feedback ---

async function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        console.warn("Sessão expirada ou inválida.");
        localStorage.clear();
        window.location.href = "login.html";
        return true;
    }
    return false;
}

function showFeedback(containerId, message, isError = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.style.display = 'block'; 
    container.classList.remove('hidden');
    
    // Rola até a mensagem se for sucesso, para o usuário ver
    if (!isError) container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideFeedback(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.classList.add('hidden');
        container.style.display = 'none';
        container.textContent = '';
    }
}

// --- Inicialização Principal ao Carregar a Página ---

document.addEventListener("DOMContentLoaded", () => {
    // 1. Tenta inicializar páginas de Auth (Login/Cadastro/Recuperação)
    initializeAuthPages();

    // 2. Verifica se estamos no painel (Dashboard) para iniciar a proteção e lógica
    // A verificação busca elementos únicos do painel
    if (document.getElementById('pedidos-list-body') || document.querySelector(".app-layout-grid")) {
        initializeProtectedPage();
    }
});

// --- Lógica de Páginas de Autenticação (Públicas) ---

function initializeAuthPages() {
    
    // --- LOGIN ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const feedbackId = 'form-error-feedback';
            
            submitButton.disabled = true;
            submitButton.textContent = 'Entrando...';
            hideFeedback(feedbackId);

            try {
                const response = await fetch('/api/loginUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: document.getElementById('email').value,
                        senha: document.getElementById('senha').value
                    })
                });
                const data = await response.json();
                
                if (!response.ok) throw new Error(data.message || 'Erro ao fazer login.');
                
                // Sucesso: Salva sessão
                localStorage.setItem('sessionToken', data.token);
                localStorage.setItem('userName', data.userName);
                window.location.href = 'painel.html'; // Redireciona para o painel
            } catch (error) {
                showFeedback(feedbackId, error.message, true);
                submitButton.disabled = false;
                submitButton.textContent = 'Entrar';
            }
        });

        // Mensagens via URL (ex: após verificar email)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('verified') === 'true') {
            showFeedback('form-error-feedback', 'E-mail verificado com sucesso! Você já pode fazer o login.', false);
        }
        if (urlParams.get('reset') === 'success') {
             showFeedback('form-error-feedback', 'Senha redefinida com sucesso! Faça login com a nova senha.', false);
        }
    }

    // --- CADASTRO ---
    const cadastroForm = document.getElementById('cadastro-form');
    if (cadastroForm) {
        cadastroForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const formWrapper = document.getElementById('form-wrapper');
            const loadingFeedback = document.getElementById('loading-feedback');
            const submitButton = cadastroForm.querySelector('button[type="submit"]');
            const feedbackId = 'form-error-feedback';
            
            const senha = document.getElementById('senha').value;
            const confirmarSenha = document.getElementById('confirmar-senha').value;
            const aceiteTermos = document.getElementById('termos-aceite').checked;

            hideFeedback(feedbackId);

            // Validações básicas
            if (!aceiteTermos) return showFeedback(feedbackId, 'Você precisa aceitar os Termos para continuar.', true);
            if (senha.length < 6) return showFeedback(feedbackId, 'Sua senha precisa ter no mínimo 6 caracteres.', true);
            if (senha !== confirmarSenha) return showFeedback(feedbackId, 'As senhas não coincidem.', true);

            // UI Loading
            submitButton.disabled = true;
            submitButton.textContent = "Processando...";
            if (formWrapper) formWrapper.classList.add('hidden');
            if (loadingFeedback) loadingFeedback.classList.remove('hidden');

            const empresaData = {
                nomeEmpresa: document.getElementById('nome_empresa').value,
                cnpj: document.getElementById('cnpj').value,
                telefoneEmpresa: document.getElementById('telefone_empresa').value,
                nomeResponsavel: document.getElementById('nome_responsavel').value,
                email: document.getElementById('email').value,
                senha: senha
            };

            try {
                const response = await fetch('/api/registerUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(empresaData)
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro no cadastro.');

                // Sucesso: Auto-login
                localStorage.setItem('sessionToken', data.token);
                localStorage.setItem('userName', data.userName);
                window.location.href = 'painel.html';

            } catch (error) {
                if (loadingFeedback) loadingFeedback.classList.add('hidden');
                if (formWrapper) formWrapper.classList.remove('hidden');
                
                showFeedback(feedbackId, error.message, true);
                submitButton.disabled = false;
                submitButton.textContent = "Criar Conta e Acessar";
            }
        });
    }

    // --- ESQUECI SENHA ---
    const esqueciSenhaForm = document.getElementById('esqueci-senha-form');
    if (esqueciSenhaForm) {
        esqueciSenhaForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const btn = event.target.querySelector('button');
            const wrapper = document.getElementById('form-wrapper');
            
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            
            try {
                const response = await fetch('/api/forgotPassword', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: document.getElementById('email').value })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                wrapper.innerHTML = `<div class="auth-header"><h1>Link Enviado!</h1><p>${data.message}</p></div>`;
            } catch (error) {
                wrapper.innerHTML = `<div class="auth-header"><h1>Erro</h1><p>${error.message}</p> <a href="esqueci-senha.html">Tentar novamente</a></div>`;
            }
        });
    }

    // --- REDEFINIR SENHA ---
    const redefinirSenhaForm = document.getElementById('redefinir-senha-form');
    if (redefinirSenhaForm) {
        redefinirSenhaForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const novaSenha = document.getElementById('nova-senha').value;
            const confirmarSenha = document.getElementById('confirmar-senha').value;
            const submitButton = redefinirSenhaForm.querySelector('button[type="submit"]');
            
            hideFeedback('form-error-feedback');
            if (novaSenha.length < 6) return showFeedback('form-error-feedback', 'Mínimo 6 caracteres.', true);
            if (novaSenha !== confirmarSenha) return showFeedback('form-error-feedback', 'As senhas não coincidem.', true);
            
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';
            const token = new URLSearchParams(window.location.search).get('token');
            
            try {
                const response = await fetch('/api/resetPassword', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token, novaSenha: novaSenha })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                window.location.href = `login.html?reset=success`;
            } catch (error) {
                showFeedback('form-error-feedback', error.message, true);
                submitButton.disabled = false;
                submitButton.textContent = 'Redefinir Senha';
            }
        });
    }

    // --- VERIFICAÇÃO DE EMAIL ---
    const feedbackText = document.getElementById('feedback-text'); // Elemento específico da página de verificação
    if (feedbackText) {
        const token = new URLSearchParams(window.location.search).get('token');
        (async () => {
            if (!token) return;
            feedbackText.textContent = 'Verificando validação...';
            try {
                const response = await fetch('/api/verifyEmail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                window.location.href = 'login.html?verified=true';
            } catch (error) {
                feedbackText.textContent = `Erro: ${error.message || 'Link inválido.'}`;
            }
        })();
    }
}

// --- Funções de Sessão Protegida ---

function initializeProtectedPage() {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");

    // Se não tem token, chuta para o login
    if (!sessionToken) {
        window.location.href = "login.html";
        return;
    }

    // Exibe nome do usuário (se existir o elemento no header)
    const greetingEl = document.getElementById('user-greeting');
    if(greetingEl && userName) greetingEl.textContent = `Olá, ${userName}!`;

    // Configura botão de Logout (se existir)
    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }

    // Inicializa a lógica específica do Dashboard (Lista de pedidos, Saldo, etc)
    // Essa função será definida na Parte 2
    if (document.getElementById('pedidos-list-body')) {
        inicializarPainelDePedidos();
    }
}
// ============================================================
// SCRIPT.JS - PARTE 2: LÓGICA DO DASHBOARD (PAINEL)
// ============================================================

// Variáveis Globais do Painel
let todosPedidos = [];
let pedidosFiltrados = [];
let paginaAtual = 1;
const itensPorPagina = 20;
let currentStatusFilter = 'todos';

// 1. Função Principal de Inicialização do Painel
function inicializarPainelDePedidos() {
    // Configura o Modal de Créditos
    setupModalCreditos();

    // Configura as Abas de Filtro (Todos, Pagamento, Andamento...)
    const tabButtonsContainer = document.querySelector('.tab-buttons');
    if (tabButtonsContainer) {
        tabButtonsContainer.addEventListener('click', (event) => {
            const clickedButton = event.target.closest('.tab-btn');
            if (!clickedButton) return;
            
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            clickedButton.classList.add('active');
            
            currentStatusFilter = clickedButton.dataset.tab;
            aplicarFiltros();
        });
    }

    // Configura a Barra de Busca
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.addEventListener("input", aplicarFiltros);
    
    // Configura os cliques nos botões da lista (Pagar, Ver Detalhes)
    ativarDropdownsDePagamento();
    
    // Carrega os dados iniciais
    atualizarDadosPainel();
}

// 2. Busca dados na API (Saldo e Lista de Pedidos)
async function atualizarDadosPainel() {
    const sessionToken = localStorage.getItem("sessionToken");
    const pedidosListBody = document.getElementById("pedidos-list-body");
    const saldoValorEl = document.getElementById("saldo-valor");

    // Mostra loading
    if(pedidosListBody) pedidosListBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Atualizando informações...</span></div>`;

    try {
        const response = await fetch('/api/getPanelData', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: sessionToken })
        });
        
        // Se der 401/403, a função handleAuthError da Parte 1 resolve
        if (!response.ok) {
            if (await handleAuthError(response)) return;
            const data = await response.json();
            throw new Error(data.message || "Erro ao buscar dados.");
        }

        const data = await response.json();

        // Atualiza Saldo na tela
        if(saldoValorEl) {
            saldoValorEl.textContent = new Intl.NumberFormat("pt-BR", { 
                style: "currency", currency: "BRL" 
            }).format(data.saldo || 0);
        }

        // Salva e renderiza a lista
        todosPedidos = data.pedidos || [];
        aplicarFiltros(); 

    } catch (error) {
        console.error("Erro no painel:", error);
        if(pedidosListBody) pedidosListBody.innerHTML = `<div class="loading-pedidos" style="color: #ef4444;">Erro: ${error.message}</div>`;
    }
}

// 3. Aplica Filtros (Status e Busca)
function aplicarFiltros() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let listaTemp = todosPedidos;

    // Filtro por Status
    if (currentStatusFilter !== 'todos') {
        listaTemp = listaTemp.filter(pedido => {
            const stageId = (pedido.STAGE_ID || "").toUpperCase();
            
            if (currentStatusFilter === 'pagamento') return stageId.includes("NEW");
            if (currentStatusFilter === 'cancelado') return stageId.includes("LOSE");
            if (currentStatusFilter === 'andamento') {
                // Tudo que não é novo, nem perdido, nem ganho (aprovado/verificado)
                return !stageId.includes("NEW") && !stageId.includes("LOSE") && !stageId.includes("WON");
            }
            return true;
        });
    }

    // Filtro por Texto
    if (searchTerm) {
        listaTemp = listaTemp.filter(p =>
            (p.TITLE || "").toLowerCase().includes(searchTerm) ||
            (p.ID || "").toString().includes(searchTerm)
        );
    }

    pedidosFiltrados = listaTemp;
    paginaAtual = 1; // Reseta para primeira página
    renderizarPedidos();
}

// 4. Renderiza o HTML da Lista (CORREÇÃO CRÍTICA AQUI PARA EXIBIR BOTÕES)
function renderizarPedidos() {
    const pedidosListBody = document.getElementById("pedidos-list-body");
    if(!pedidosListBody) return;

    pedidosListBody.innerHTML = "";

    if (pedidosFiltrados && pedidosFiltrados.length > 0) {
        const indiceInicio = (paginaAtual - 1) * itensPorPagina;
        const indiceFim = indiceInicio + itensPorPagina;
        const pedidosPagina = pedidosFiltrados.slice(indiceInicio, indiceFim);
        
        let html = "";

        pedidosPagina.forEach(pedido => {
            let statusInfo = { texto: "Desconhecido", classe: "" };
            let acaoHtml = ""; // HTML dos botões

            const stageId = (pedido.STAGE_ID || "").toUpperCase();
            const id = pedido.ID;

            // Define Status e Botões
            if (stageId.includes("NEW")) {
                statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                // RECRIA O MENU DROPDOWN DE PAGAMENTO
                acaoHtml = `
                    <div class="dropdown-pagamento">
                        <button type="button" class="btn-pagar" data-deal-id="${id}">
                            Pagar <i class="fas fa-caret-down"></i>
                        </button>
                        <div class="dropdown-content">
                            <button type="button" class="btn-pagar-saldo" data-deal-id="${id}">💰 Usar Saldo</button>
                            <button type="button" class="btn-gerar-cobranca" data-deal-id="${id}">💠 Gerar PIX</button>
                        </div>
                    </div>
                `;
            } 
            else if (stageId.includes("LOSE")) {
                statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Ver Motivo</a>`;
            } 
            else if (stageId === "C17:UC_2OEE24") {
                statusInfo = { texto: 'Em Análise', classe: 'status-analise' };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Ver Detalhes</a>`;
            } 
            else if (stageId.includes("WON") || stageId === "C17:WON") {
                statusInfo = { texto: "Concluído", classe: "status-aprovado" };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Ver Arquivos</a>`;
            } 
            else {
                statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Acompanhar</a>`;
            }

            const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(pedido.OPPORTUNITY) || 0);

            html += `
                <div class="pedido-item">
                    <div class="col-id"><strong>#${id}</strong></div>
                    <div class="col-titulo">${pedido.TITLE}</div>
                    <div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div>
                    <div class="col-valor">${valorFormatado}</div>
                    <div class="col-acoes" style="overflow: visible;">${acaoHtml}</div>
                </div>
            `;
        });

        pedidosListBody.innerHTML = html;
    } else {
        pedidosListBody.innerHTML = `<div class="loading-pedidos" style="padding: 30px;">Nenhum pedido encontrado com este filtro.</div>`;
    }
}

// 5. Lógica de Eventos dos Botões de Pagamento (Dropdown, Saldo, PIX)
function ativarDropdownsDePagamento() {
    const pedidosListBody = document.getElementById('pedidos-list-body');
    if (!pedidosListBody) return;

    pedidosListBody.addEventListener('click', async function(event) {
        const target = event.target;
        
        // CLIQUE NO BOTÃO "PAGAR" (Abre/Fecha Menu)
        const btnPagar = target.closest('.btn-pagar');
        if (btnPagar) {
            const dropdown = btnPagar.closest('.dropdown-pagamento');
            // Fecha todos os outros
            document.querySelectorAll('.dropdown-pagamento.active').forEach(d => {
                if(d !== dropdown) d.classList.remove('active');
            });
            // Alterna o atual
            if(dropdown) dropdown.classList.toggle('active');
            event.stopPropagation(); // Impede que o clique feche imediatamente
            return;
        }

        // CLIQUE EM "USAR SALDO"
        if (target.classList.contains('btn-pagar-saldo')) {
            const dealId = target.dataset.dealId;
            if (!confirm('Deseja usar seu saldo de créditos para pagar este pedido imediatamente?')) return;
            
            const originalText = target.textContent;
            target.disabled = true; 
            target.textContent = 'Processando...';
            
            try {
                const response = await fetch('/api/payWithBalance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), dealId: dealId })
                });
                const data = await response.json();
                
                if (!response.ok) throw new Error(data.message || "Erro no pagamento.");
                
                alert('Sucesso! Pagamento realizado.');
                atualizarDadosPainel(); // Recarrega lista e saldo
            } catch (error) {
                alert(`Erro: ${error.message}`);
                target.disabled = false; 
                target.textContent = originalText;
            }
        }

        // CLIQUE EM "GERAR PIX"
        if (target.classList.contains('btn-gerar-cobranca')) {
            const dealId = target.dataset.dealId;
            const originalText = target.textContent;
            target.disabled = true; 
            target.textContent = 'Gerando...';
            
            try {
                const response = await fetch('/api/generatePixForDeal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), dealId: dealId })
                });
                const data = await response.json();
                
                if (!response.ok) throw new Error(data.message || "Erro ao gerar PIX.");
                
                // Abre o link do Asaas em nova aba
                window.open(data.url, '_blank');
                
                // Fecha o dropdown
                const dropdown = target.closest('.dropdown-pagamento');
                if(dropdown) dropdown.classList.remove('active');

            } catch (error) {
                alert(`Erro: ${error.message}`);
            } finally {
                target.disabled = false; 
                target.textContent = originalText;
            }
        }
    });

    // Fecha dropdowns se clicar fora
    window.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown-pagamento')) {
            document.querySelectorAll('.dropdown-pagamento.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
}

// 6. Lógica do Modal de Adicionar Créditos
function setupModalCreditos() {
    const modal = document.getElementById("modal-adquirir-creditos");
    const btnOpen = document.querySelector(".btn-add-credito");
    const form = document.getElementById("adquirir-creditos-form");
    
    if (!modal || !btnOpen) return;

    const btnClose = modal.querySelector(".close-modal");

    // Abrir Modal
    btnOpen.addEventListener("click", (e) => {
        e.preventDefault();
        modal.classList.add("active"); // Usa a classe CSS que definimos no HTML
    });

    // Fechar Modal (Botão X)
    if(btnClose) btnClose.addEventListener("click", () => modal.classList.remove("active"));

    // Fechar Modal (Clicar fora)
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
    });

    // Envio do Formulário de Créditos
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = form.querySelector("button[type='submit']");
            const feedbackId = "creditos-form-error";
            const valorInput = document.getElementById("creditos-valor");
            
            hideFeedback(feedbackId);
            
            const valor = valorInput.value;
            if (!valor || parseFloat(valor) < 5) {
                return showFeedback(feedbackId, "O valor mínimo é R$ 5,00.", true);
            }
            
            submitButton.disabled = true; 
            submitButton.textContent = "Gerando cobrança...";
            
            try {
                const response = await fetch('/api/addCredit', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        token: localStorage.getItem("sessionToken"), 
                        valor: valor 
                    })
                });
                const data = await response.json();
                
                if (!response.ok) throw new Error(data.message || "Erro ao gerar cobrança.");
                
                // Abre link de pagamento
                window.open(data.url, '_blank');
                
                // Fecha e limpa
                modal.classList.remove("active");
                form.reset();
                
            } catch (error) {
                showFeedback(feedbackId, error.message, true);
            } finally {
                submitButton.disabled = false; 
                submitButton.textContent = "Gerar Cobrança";
            }
        });
    }
}
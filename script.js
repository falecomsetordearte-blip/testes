async function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = "login.html";
        return true;
    }
    return false;
}

function detectarErroSessaoSubstituida(error) {
    const mensagemErro = error.message || error.toString();
    const padroesSessaoInvalida = [
        'Unexpected token',
        'is not valid JSON',
        'Você entrou',
        'message\': Você',
        'SyntaxError'
    ];
    const isErroSessao = padroesSessaoInvalida.some(padrao =>
        mensagemErro.includes(padrao)
    );
    return isErroSessao;
}

function exibirAlertaSessaoSubstituida() {
    let modal = document.getElementById('modal-sessao-substituida');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-sessao-substituida';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content sessao-substituida">
                    <div class="modal-body">
                        <h3>Sessão Expirada</h3>
                        <p>Entre novamente.</p>
                    </div>
                    <div class="modal-footer">
                        <button id="btn-ok-login" class="btn btn-primary">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (!document.getElementById('sessao-substituida-styles')) {
            const styles = document.createElement('style');
            styles.id = 'sessao-substituida-styles';
            styles.textContent = `
                #modal-sessao-substituida .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; }
                #modal-sessao-substituida .modal-content.sessao-substituida { background: white; border-radius: 12px; padding: 0; max-width: 350px; width: 90%; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); animation: slideIn 0.3s ease-out; }
                #modal-sessao-substituida .modal-body { padding: 30px 25px 20px 25px; text-align: center; }
                #modal-sessao-substituida .modal-body h3 { margin: 0 0 15px 0; color: #333; font-size: 1.3em; font-weight: 600; }
                #modal-sessao-substituida .modal-body p { margin: 0; color: #666; line-height: 1.5; }
                #modal-sessao-substituida .modal-footer { padding: 0 25px 25px 25px; text-align: center; }
                #modal-sessao-substituida .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 1em; font-weight: 500; cursor: pointer; transition: all 0.3s ease; min-width: 100px; }
                #modal-sessao-substituida .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4); }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-50px); } to { opacity: 1; transform: translateY(0); } }
            `;
            document.head.appendChild(styles);
        }
    }
    modal.style.display = 'block';
    const btnOk = document.getElementById('btn-ok-login');
    btnOk.onclick = () => {
        localStorage.clear();
        window.location.href = "login.html";
    };
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            localStorage.clear();
            window.location.href = "login.html";
        }
    });
}

const CRIAR_PEDIDO_WEBHOOK_URL = 'https://hook.us2.make.com/548en3dbsynv4c2e446jvcwrizl7trut';
const PAGAR_COM_SALDO_URL = 'https://hook.us2.make.com/3dtcbbrxqh1s2o8cdcjxj37iyq4bd736';
const GERAR_COBRANCA_URL = 'https://hook.us2.make.com/7ub1y8w9v23rkyd6tumh84p5l21knquv';
const ADICIONAR_CREDITOS_URL = 'https://hook.us2.make.com/5p9m8o8p6hhglqlmxkj5sc7t2ztr8yic';

function showFeedback(containerId, message, isError = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.classList.remove('hidden');
}

function hideFeedback(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.classList.add('hidden');
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

const cadastroForm = document.getElementById('cadastro-form');
if (cadastroForm) {
    cadastroForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formWrapper = document.getElementById('form-wrapper');
        const loadingFeedback = document.getElementById('loading-feedback');
        const submitButton = cadastroForm.querySelector('button[type="submit"]');
        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        const aceiteTermos = document.getElementById('termos-aceite').checked;
        hideFeedback('form-error-feedback');
        if (!aceiteTermos) {
            return showFeedback('form-error-feedback', 'Você precisa aceitar os Termos para continuar.', true);
        }
        if (senha.length < 6) {
            return showFeedback('form-error-feedback', 'Sua senha precisa ter no mínimo 6 caracteres.', true);
        }
        if (senha !== confirmarSenha) {
            return showFeedback('form-error-feedback', 'As senhas não coincidem.', true);
        }
        submitButton.disabled = true;
        formWrapper.classList.add('hidden');
        loadingFeedback.classList.remove('hidden');
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
            if (!response.ok) {
                throw new Error(data.message || 'Ocorreu um erro desconhecido.');
            }
            window.location.href = data.checkoutUrl;
        } catch (error) {
            loadingFeedback.classList.add('hidden');
            formWrapper.classList.remove('hidden');
            showFeedback('form-error-feedback', error.message, true);
            submitButton.disabled = false;
        }
    });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Entrando...';
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
            if (!response.ok) {
                throw new Error(data.message || 'Ocorreu um erro desconhecido.');
            }
            localStorage.setItem('sessionToken', data.token);
            localStorage.setItem('userName', data.userName);
            window.location.href = 'painel.html';
        } catch (error) {
            showFeedback('form-error-feedback', error.message, true);
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar';
        }
    });
}

const esqueciSenhaForm = document.getElementById('esqueci-senha-form');
if (esqueciSenhaForm) {
    const formWrapper = document.getElementById('form-wrapper');
    esqueciSenhaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const btn = event.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        try {
            const response = await fetch('/api/forgotPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: document.getElementById('email').value })
            });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.message); }
            formWrapper.innerHTML = `<div class="auth-header"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte"><h1>Link Enviado!</h1><p>${data.message || 'Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.'}</p></div>`;
        } catch (error) {
            formWrapper.innerHTML = `<div class="auth-header"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte"><h1>Ocorreu um Erro</h1><p>${error.message || 'Não foi possível processar a solicitação. Por favor, tente novamente mais tarde.'}</p></div>`;
        }
    });
}

const redefinirSenhaForm = document.getElementById('redefinir-senha-form');
if (redefinirSenhaForm) {
    redefinirSenhaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const novaSenha = document.getElementById('nova-senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        const submitButton = redefinirSenhaForm.querySelector('button[type="submit"]');
        hideFeedback('form-error-feedback');
        if (novaSenha.length < 6) {
            return showFeedback('form-error-feedback', 'Sua senha precisa ter no mínimo 6 caracteres.', true);
        }
        if (novaSenha !== confirmarSenha) {
            return showFeedback('form-error-feedback', 'As senhas não coincidem.', true);
        }
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (!token) {
            showFeedback('form-error-feedback', 'Token de redefinição não encontrado. Link inválido.', true);
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Nova Senha';
            return;
        }
        try {
            const response = await fetch('/api/resetPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, novaSenha: novaSenha })
            });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.message); }
            window.location.href = `login.html?reset=success`;
        } catch (error) {
            showFeedback('form-error-feedback', error.message, true);
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Nova Senha';
        }
    });
}

if (window.location.pathname.endsWith('/verificacao.html')) {
    const feedbackText = document.getElementById('feedback-text');
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    (async () => {
        if (!token) {
            feedbackText.textContent = 'Link de verificação inválido ou incompleto.';
            return;
        }
        try {
            const response = await fetch('/api/verifyEmail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message);
            }
            window.location.href = 'login.html?verified=true';
        } catch (error) {
            feedbackText.textContent = `Erro: ${error.message || 'Não foi possível verificar seu e-mail.'}`;
        }
    })();
}

if (window.location.pathname.endsWith('/login.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const isVerified = urlParams.get('verified');
        const resetSuccess = urlParams.get('reset');
        if (isVerified === 'true') {
            showFeedback('form-error-feedback', 'E-mail verificado com sucesso! Você já pode fazer o login.', false);
        }
        if (resetSuccess === 'success') {
             showFeedback('form-error-feedback', 'Senha redefinida com sucesso! Você já pode fazer o login com a nova senha.', false);
        }
    });
}

let todosPedidos = [];
let paginaAtual = 1;
const itensPorPagina = 20;
let pedidosFiltrados = [];

async function atualizarDadosPainel() {
    const sessionToken = localStorage.getItem("sessionToken");
    const pedidosListBody = document.getElementById("pedidos-list-body");
    const saldoValorEl = document.getElementById("saldo-valor");
    if (!sessionToken) {
        localStorage.clear();
        window.location.href = "login.html";
        return;
    }
    pedidosListBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Carregando seus pedidos...</span></div>`;
    try {
        const response = await fetch('/api/getPanelData', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: sessionToken })
        });
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            if (detectarErroSessaoSubstituida(jsonError)) {
                exibirAlertaSessaoSubstituida();
                return;
            }
            throw jsonError;
        }
        if (!response.ok) {
            if (await handleAuthError(response)) { return; }
            throw new Error(data.message || "Erro ao buscar dados.");
        }
        if (data.statusConta && data.statusConta !== '1') {
            document.body.innerHTML = `<div class="auth-page"><div class="auth-container" style="text-align: center;"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte" style="height: 80px; margin-bottom: 20px;"><h1>Acesso Suspenso</h1><p style="color: var(--cinza-texto); line-height: 1.6;">Sua assinatura está com uma pendência de pagamento...</p><a href="login.html" style="display: inline-block; margin-top: 30px; color: var(--azul-principal); font-weight: 600;">Sair</a></div></div>`;
            localStorage.clear();
            return;
        }
        saldoValorEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.saldo || 0);
        todosPedidos = data.pedidos || [];
        paginaAtual = 1;
        aplicarFiltros();
    } catch (error) {
        const errorMessage = `Falha ao carregar dados do painel. Causa: ${error.message}`;
        console.error(errorMessage);
        if (pedidosListBody) {
             pedidosListBody.innerHTML = `<div class="loading-pedidos" style="color: var(--erro);">${errorMessage}</div>`;
        }
    }
}

function renderizarPedidos() {
    const pedidosListBody = document.getElementById("pedidos-list-body");
    pedidosListBody.innerHTML = "";
    if (pedidosFiltrados && pedidosFiltrados.length > 0) {
        const indiceInicio = (paginaAtual - 1) * itensPorPagina;
        const indiceFim = indiceInicio + itensPorPagina;
        const pedidosPagina = pedidosFiltrados.slice(indiceInicio, indiceFim);
        let pedidosHtml = "";
        pedidosPagina.forEach(pedido => {
            let statusInfo = { texto: "Desconhecido", classe: "" };
            let notificacaoHtml = '';
            if (pedido.notificacao === true) {
                notificacaoHtml = '<span class="notificacao-badge"><i class="fa-solid fa-circle"></i></span>';
            }
            let acaoHtml = `<a href="pedido.html?id=${pedido.ID}" class="btn-ver-pedido">Ver Detalhes${notificacaoHtml}</a>`;
            const stageId = pedido.STAGE_ID || "";
            if (stageId.includes("NEW")) {
                statusInfo = { texto: "Aguardando Pagamento", classe: "status-pagamento" };
                acaoHtml = `<div class="dropdown-pagamento"><button class="btn-pagar" data-deal-id="${pedido.ID}">Pagar Agora</button><div class="dropdown-content"><button class="btn-pagar-saldo" data-deal-id="${pedido.ID}">Usar Saldo</button><button class="btn-gerar-cobranca" data-deal-id="${pedido.ID}">PIX</button></div></div>`;
            } else if (stageId.includes("LOSE")) {
                statusInfo = { texto: "Cancelado", classe: "status-cancelado" };
            } else {
                statusInfo = { texto: "Em Andamento", classe: "status-andamento" };
            }
            const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(pedido.OPPORTUNITY) || 0);
            pedidosHtml += `<div class="pedido-item"><div class="col-id"><strong>#${pedido.ID}</strong></div><div class="col-titulo">${pedido.TITLE}</div><div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div><div class="col-valor">${valorFormatado}</div><div class="col-acoes">${acaoHtml}</div></div>`;
        });
        pedidosListBody.innerHTML = pedidosHtml;
    } else {
        pedidosListBody.innerHTML = `<div class="loading-pedidos" style="padding: 50px 20px;">Nenhum pedido encontrado.</div>`;
    }
}

function aplicarFiltros() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    if (searchTerm) {
        pedidosFiltrados = todosPedidos.filter(pedido =>
            (pedido.TITLE || "").toLowerCase().includes(searchTerm) ||
            (pedido.ID || "").toString().includes(searchTerm)
        );
    } else {
        pedidosFiltrados = todosPedidos;
    }
    paginaAtual = 1;
    renderizarPedidos();
}

function inicializarPainel() {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");
    if (!sessionToken || !userName) {
        localStorage.clear();
        window.location.href = "login.html";
        return;
    }
    document.getElementById("user-greeting").textContent = `Olá, ${userName}!`;
        // --- LÓGICA PARA O MODAL DE NOVO PEDIDO ---
    const modalNovoPedido = document.getElementById("modal-novo-pedido");
    const btnOpenModalNovoPedido = document.querySelector(".btn-novo-pedido");
    const btnCloseModalNovoPedido = modalNovoPedido.querySelector(".close-modal");
    const formNovoPedido = document.getElementById("novo-pedido-form");

    // Listener para ABRIR o modal
    btnOpenModalNovoPedido.addEventListener("click", () => modalNovoPedido.classList.add("active"));
    
    // Listener para FECHAR o modal (apenas no botão 'X')
    btnCloseModalNovoPedido.addEventListener("click", () => modalNovoPedido.classList.remove("active"));

    // Listener para o ENVIO do formulário
    formNovoPedido.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = formNovoPedido.querySelector("button[type='submit']");
        submitButton.disabled = true;
        submitButton.textContent = "Criando...";
        hideFeedback("pedido-form-error");

        const pedidoData = {
            token: sessionToken,
            titulo: document.getElementById("pedido-titulo").value,
            cliente_nome: document.getElementById("cliente-final-nome").value,
            cliente_wpp: document.getElementById("cliente-final-wpp").value,
            briefing: document.getElementById("pedido-briefing").value,
            valor: document.getElementById("pedido-valor").value,
            formato: document.getElementById("pedido-formato").value,
            // O campo de link de arquivos não está no seu HTML, mas se estivesse, seria adicionado aqui.
        };

        try {
            // AINDA USA O WEBHOOK ANTIGO DO MAKE.COM
            const response = await fetch(CRIAR_PEDIDO_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pedidoData)
            });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.message || "Erro ao criar pedido."); }

            alert("Pedido criado! Ele aparecerá na sua lista como 'Aguardando Pagamento'.");
            modalNovoPedido.classList.remove("active");
            formNovoPedido.reset();
            await atualizarDadosPainel(); // Recarrega os dados do painel

        } catch (error) {
            showFeedback("pedido-form-error", error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Criar Pedido";
        }
    });
    document.getElementById("logout-button").addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", aplicarFiltros);
    }
    atualizarDadosPainel();
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(".main-painel")) {
        inicializarPainel();
    }
});



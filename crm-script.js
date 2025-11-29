// crm-script.js - VERSÃO COM SALDO INTELIGENTE

let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) { window.location.href = '/login.html'; return; }

    injectCleanStyles();
    createToastContainer();
    configurarMascaras();
    carregarKanban();
    configurarBuscaCliente();
    configurarFormularioVisual();
    configurarDragScroll();
    configurarBotaoProducao();
    setupModalCreditos(); // Configura o modal de crédito
});

// --- FUNÇÃO PARA BUSCAR SALDO (NOVO) ---
async function fetchSaldoCRM() {
    const container = document.getElementById('saldo-container');
    const display = document.getElementById('crm-saldo-display');
    const token = localStorage.getItem('sessionToken');

    if (!container || !display) return;

    // Mostra loading
    container.style.display = 'block';
    display.innerText = '...';

    try {
        const res = await fetch('/api/crm/getBalance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token })
        });
        const data = await res.json();
        
        const valor = parseFloat(data.saldo || 0);
        display.innerText = valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        
        // Cor visual: Verde se tem saldo, Vermelho se zerado
        if (valor > 0) display.style.color = '#2ecc71';
        else display.style.color = '#e74c3c';

    } catch (e) {
        console.error(e);
        display.innerText = 'Erro';
    }
}

// ... (injectCleanStyles, createToastContainer, showToast IGUAIS AO ANTERIOR) ...
// ... MANTENHA AS FUNÇÕES DE ESTILO E TOAST AQUI ... 
// ... Pulei para economizar espaço, mas mantenha-as no arquivo final ...

function injectCleanStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* SEUS ESTILOS EXISTENTES AQUI... */
        /* ... */
        
        /* Ajuste do Link no Toast */
        .toast-message a { color: #e74c3c; font-weight: bold; text-decoration: underline; cursor: pointer; }
    `;
    document.head.appendChild(style);
}

function createToastContainer() {
    const div = document.createElement('div');
    div.className = 'toast-container';
    document.body.appendChild(div);
}

function showToast(message, type = 'success', duration = 5000) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

// ... (configurarDragScroll, configurarMascaras IGUAIS) ...
function configurarDragScroll() { /* ... */ }
function configurarMascaras() { /* ... */ }

// --- CONFIGURAÇÃO DO FORMULÁRIO (ALTERADA) ---
function configurarFormularioVisual() {
    // ... (cards de serviço iguais) ...
    const cards = document.querySelectorAll('.servico-card');
    const container = document.getElementById('servico-selection-container');
    const hiddenInput = document.getElementById('pedido-servico-hidden');
    const contentWrapper = document.getElementById('form-content-wrapper');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            if(container.classList.contains('selection-made') && !card.classList.contains('active')) return;
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            hiddenInput.value = card.dataset.value;
            container.classList.add('selection-made');
            contentWrapper.classList.add('visible');
        });
    });

    const radiosArte = document.querySelectorAll('input[name="pedido-arte"]');
    const arqFields = document.getElementById('arquivo-cliente-fields');
    const setorFields = document.getElementById('setor-arte-fields');
    const saldoContainer = document.getElementById('saldo-container'); // NOVO

    radiosArte.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            arqFields.classList.add('hidden');
            setorFields.classList.add('hidden');
            
            // Esconde saldo por padrão
            if(saldoContainer) saldoContainer.style.display = 'none';

            ['link-arquivo', 'pedido-supervisao', 'valor-designer', 'pedido-formato'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.required = false;
            });

            if (val === 'Arquivo do Cliente') {
                arqFields.classList.remove('hidden');
                document.getElementById('link-arquivo').required = true;
            } else if (val === 'Setor de Arte') {
                setorFields.classList.remove('hidden');
                ['pedido-supervisao', 'valor-designer', 'pedido-formato'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.required = true;
                });
                
                // >>> CHAMA O SALDO AQUI <<<
                fetchSaldoCRM(); 
            }
        });
    });

    // Botão "+ Adicionar" (abre modal)
    const btnAddSaldo = document.getElementById('btn-add-saldo-crm');
    if(btnAddSaldo) {
        btnAddSaldo.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById("modal-adquirir-creditos");
            if(modal) modal.classList.add("active");
        });
    }

    // ... (resto igual) ...
    document.getElementById('pedido-formato').addEventListener('change', (e) => {
        const div = document.getElementById('cdr-versao-container');
        e.target.value === 'CDR' ? div.classList.remove('hidden') : div.classList.add('hidden');
    });
    document.getElementById('btn-add-material').addEventListener('click', () => adicionarMaterialNoForm());
}

function adicionarMaterialNoForm(desc = '', det = '') { /* ... IGUAL ... */ }
async function carregarKanban() { /* ... IGUAL ... */ }
function criarCardHTML(card) { /* ... IGUAL ... */ }
function inicializarDragAndDrop() { /* ... IGUAL ... */ }
function atualizarStatus(id, novaColuna) { /* ... IGUAL ... */ }

// ... (Funções de Panel/Busca/Salvar IGUAIS) ...
const overlay = document.getElementById('slide-overlay');
const panel = document.getElementById('slide-panel');
function resetarForm() { /* ... IGUAL ... */ }
window.abrirPanelNovo = function() { /* ... IGUAL ... */ }
window.abrirPanelEdicao = function(card) { /* ... IGUAL ... */ }
window.fecharPanel = function() { /* ... IGUAL ... */ }
function configurarBuscaCliente() { /* ... IGUAL ... */ }
document.getElementById('form-crm').addEventListener('submit', async (e) => { /* ... IGUAL ... */ });

// --- LÓGICA DO MODAL DE CRÉDITO (ADAPTADA) ---
function setupModalCreditos() {
    const modal = document.getElementById("modal-adquirir-creditos");
    const form = document.getElementById("adquirir-creditos-form");
    if (!modal) return;

    // Fechar
    const btnClose = modal.querySelector(".close-modal");
    if(btnClose) btnClose.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const btn = form.querySelector("button[type='submit']");
            const valorInput = document.getElementById("creditos-valor");
            const feedbackId = "creditos-form-error";
            const feedback = document.getElementById(feedbackId);
            
            if(feedback) feedback.style.display = 'none';
            
            const valor = valorInput.value;
            if (!valor || parseFloat(valor) < 5) {
                if(feedback) { feedback.innerText = "Mínimo R$ 5,00."; feedback.style.display = 'block'; }
                return;
            }
            
            btn.disabled = true; 
            btn.textContent = "Gerando...";
            
            try {
                const res = await fetch('/api/addCredit', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        token: localStorage.getItem("sessionToken"), 
                        valor: valor 
                    })
                });
                const data = await res.json();
                
                if (!res.ok) throw new Error(data.message || "Erro ao gerar cobrança.");
                
                // Abre link de pagamento
                window.open(data.url, '_blank');
                
                // Fecha o modal e avisa
                modal.classList.remove("active");
                form.reset();
                alert("Cobrança gerada! Após o pagamento, seu saldo será atualizado. (A página será recarregada).");
                window.location.reload(); // Recarrega para atualizar o saldo
                
            } catch (error) {
                if(feedback) { feedback.innerText = error.message; feedback.style.display = 'block'; }
            } finally {
                btn.disabled = false; 
                btn.textContent = "Pagar Agora";
            }
        });
    }
}

// --- CONFIGURAR BOTÃO PRODUÇÃO (COM TRATAMENTO DE ERRO HTML) ---
function configurarBotaoProducao() {
    const btn = document.getElementById('btn-produzir-final');
    if(!btn) return;

    let confirmationStage = false;

    btn.addEventListener('click', async () => {
        const id = document.getElementById('card-id-db').value;
        if(!id) return showToast('Salve o card antes de enviar.', 'error');

        if (!confirmationStage) {
            confirmationStage = true;
            btn.innerHTML = '<i class="fa-solid fa-question-circle"></i> Tem certeza? Clique p/ confirmar';
            btn.classList.add('btn-confirmacao-ativa');
            setTimeout(() => {
                if (confirmationStage) {
                    confirmationStage = false;
                    btn.innerHTML = '<i class="fa-solid fa-rocket"></i> APROVAR AGORA';
                    btn.classList.remove('btn-confirmacao-ativa');
                }
            }, 4000);
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:15px; height:15px; border-width:2px; display:inline-block; vertical-align:middle; margin:0; border-top-color:#fff;"></div> Enviando...';
        btn.classList.remove('btn-confirmacao-ativa');

        let txt = "";
        document.querySelectorAll('.material-item').forEach((d, i) => {
            txt += `--- Item ${i+1} ---\nMaterial: ${d.querySelector('.mat-desc').value}\nDetalhes: ${d.querySelector('.mat-det').value}\n\n`;
        });

        const payload = {
            sessionToken: localStorage.getItem('sessionToken'),
            titulo: document.getElementById('crm-titulo-manual').value || document.getElementById('display-id-automatico').innerText,
            servico: document.getElementById('pedido-servico-hidden').value,
            arte: document.querySelector('input[name="pedido-arte"]:checked')?.value,
            nomeCliente: document.getElementById('crm-nome').value,
            wppCliente: document.getElementById('crm-wpp').value,
            tipoEntrega: document.querySelector('input[name="tipo-entrega"]:checked')?.value,
            briefingFormatado: txt,
            linkArquivo: document.getElementById('link-arquivo').value,
            supervisaoWpp: document.getElementById('pedido-supervisao').value,
            valorDesigner: document.getElementById('valor-designer').value,
            formato: document.getElementById('pedido-formato').value,
            cdrVersao: document.getElementById('cdr-versao').value
        };

        try {
            const res = await fetch('/api/createDealForGrafica', {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if(!data.success && !data.dealId) throw new Error(data.message || 'Erro desconhecido');

            await fetch('/api/crm/deleteCard', {
                method: 'POST', headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: id })
            });

            showToast('Pedido enviado para Produção!', 'success');
            fecharPanel();
            carregarKanban();
        } catch(err) { 
            // Mostra o erro HTML retornado pela API no Toast (ex: link para carteira)
            // Usamos innerHTML no showToast para que o link funcione
            const msg = err.message || "Erro desconhecido";
            showToast(msg, 'error', 10000); // 10s para ler
            
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Tentar Novamente';
            confirmationStage = false;
        }
    });
}
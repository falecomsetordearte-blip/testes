// expedicao/script.js

document.addEventListener('DOMContentLoaded', () => {
    injectCleanStyles(); // Garante estilos do toast
    carregarPedidos();
    configurarBusca();
});

let debounceTimeout = null;

// --- BUSCA E LISTAGEM ---
function configurarBusca() {
    const input = document.getElementById('input-busca');
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        document.getElementById('lista-expedicao').innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Filtrando...</div>';
        debounceTimeout = setTimeout(() => {
            carregarPedidos(e.target.value);
        }, 600);
    });
}

async function carregarPedidos(termoBusca = '') {
    const container = document.getElementById('lista-expedicao');
    try {
        const res = await fetch('/api/expedicao/listar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sessionToken: localStorage.getItem('sessionToken'),
                query: termoBusca 
            })
        });

        const pedidos = await res.json();

        if (pedidos.length === 0) {
            container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">Nenhum pedido encontrado.</div>';
            return;
        }

        container.innerHTML = '';
        pedidos.forEach(p => container.appendChild(criarLinhaPedido(p)));

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="padding:20px; color:red; text-align:center;">Erro ao carregar lista.</div>';
    }
}

function criarLinhaPedido(p) {
    const div = document.createElement('div');
    div.className = 'exp-item grid-layout'; // Aplica o grid novo
    
    const isEntregue = p.status_expedicao === 'Entregue';
    const badgeClass = isEntregue ? 'st-entregue' : 'st-aguardando';
    const iconClass = isEntregue ? 'fa-check' : 'fa-clock';

    // Novo Layout: Título | Cliente | Status | Icone
    div.innerHTML = `
        <div style="font-weight:700; color:#334155;">${p.titulo}</div>
        <div style="font-weight:600; color:#64748b;">${p.nome_cliente}</div>
        <div style="text-align:center;">
            <span class="badge-status ${badgeClass}"><i class="fas ${iconClass}"></i> ${p.status_expedicao}</span>
        </div>
        <div style="text-align:right; color:#cbd5e1;">
            <i class="fas fa-chevron-right"></i>
        </div>
    `;

    div.addEventListener('click', () => abrirGaveta(p));
    return div;
}

// --- GAVETA LATERAL ---
function abrirGaveta(p) {
    const overlay = document.getElementById('drawer-overlay');
    const panel = document.getElementById('drawer-panel');

    // Preencher Dados
    document.getElementById('d-id-bitrix').innerText = `#${p.id_bitrix}`;
    document.getElementById('d-titulo').innerText = p.titulo;
    document.getElementById('d-cliente').innerText = p.nome_cliente;
    document.getElementById('d-wpp').innerText = p.whatsapp;
    document.getElementById('d-briefing').innerText = p.briefing || 'Sem detalhes.';
    
    // Status e Cores
    const isEntregue = p.status_expedicao === 'Entregue';
    const statusEl = document.getElementById('d-status');
    statusEl.innerText = p.status_expedicao;
    statusEl.style.color = isEntregue ? '#15803d' : '#c2410c';

    // WhatsApp Link
    const btnWpp = document.getElementById('btn-wpp-link');
    if(p.whatsapp && p.whatsapp.length > 5) {
        const num = p.whatsapp.replace(/\D/g, '');
        btnWpp.href = `https://wa.me/55${num}`;
        btnWpp.style.display = 'inline-block';
    } else {
        btnWpp.style.display = 'none';
    }

    // Botão de Ação com Lógica de Confirmação
    configurarBotaoAcao(p, isEntregue);

    overlay.classList.add('active');
    panel.classList.add('active');
}

function configurarBotaoAcao(p, isEntregue) {
    const btnAcao = document.getElementById('btn-gaveta-entregar');
    
    // Reset visual e lógica
    btnAcao.dataset.confirming = "false";
    btnAcao.classList.remove('btn-confirm-state');

    if (isEntregue) {
        btnAcao.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGUE EM ' + (p.data_entrega ? new Date(p.data_entrega).toLocaleDateString() : 'DATA N/D');
        btnAcao.className = 'btn-entregar-lg btn-acao-entregue';
        btnAcao.disabled = true;
        btnAcao.onclick = null;
    } else {
        btnAcao.innerHTML = '<i class="fas fa-box-open"></i> MARCAR COMO ENTREGUE';
        btnAcao.className = 'btn-entregar-lg btn-acao-entregar';
        btnAcao.disabled = false;
        
        if(p.id_interno) {
            // Lógica de 2 cliques para confirmar
            btnAcao.onclick = () => {
                if (btnAcao.dataset.confirming === "true") {
                    marcarEntregue(p.id_interno, btnAcao);
                } else {
                    btnAcao.dataset.confirming = "true";
                    btnAcao.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Clique novamente para confirmar';
                    btnAcao.classList.add('btn-confirm-state');
                    
                    // Reseta após 3 segundos se não clicar
                    setTimeout(() => {
                        if (btnAcao.dataset.confirming === "true") {
                            btnAcao.dataset.confirming = "false";
                            btnAcao.innerHTML = '<i class="fas fa-box-open"></i> MARCAR COMO ENTREGUE';
                            btnAcao.classList.remove('btn-confirm-state');
                        }
                    }, 3000);
                }
            };
        } else {
            btnAcao.innerHTML = 'Sincronização Pendente';
            btnAcao.disabled = true;
        }
    }
}

function fecharGaveta() {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('drawer-panel').classList.remove('active');
}

async function marcarEntregue(idInterno, btnElement) {
    // Estado de Carregamento
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; 
    btnElement.classList.remove('btn-confirm-state');
    btnElement.disabled = true;

    try {
        const res = await fetch('/api/expedicao/entregar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sessionToken: localStorage.getItem('sessionToken'),
                id: idInterno 
            })
        });

        if (res.ok) {
            fecharGaveta();
            showToast('Pedido entregue com sucesso!', 'success');
            // Atualiza a lista mantendo a busca
            carregarPedidos(document.getElementById('input-busca').value);
        } else {
            throw new Error('Falha na API');
        }
    } catch (err) {
        showToast('Erro ao atualizar: ' + err.message, 'error');
        // Restaura botão
        btnElement.innerHTML = 'Tentar Novamente'; 
        btnElement.disabled = false;
        btnElement.dataset.confirming = "false";
    }
}

// --- UTILITÁRIOS (Toast e CSS) ---

function injectCleanStyles() {
    // Garante que o CSS do Toast exista mesmo se o CSS principal falhar
    if(document.getElementById('dynamic-toast-style')) return;
    const style = document.createElement('style');
    style.id = 'dynamic-toast-style';
    style.textContent = `
        .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10010; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
        .toast { pointer-events: auto; background: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 5px 25px rgba(0,0,0,0.2); border-left: 5px solid #ccc; min-width: 300px; animation: slideIn 0.3s forwards; display: flex; align-items: center; gap: 10px; }
        .toast.success { border-left-color: #2ecc71; }
        .toast.error { border-left-color: #e74c3c; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    `;
    document.head.appendChild(style);
}

function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fas fa-check-circle" style="color:#2ecc71"></i>' : '<i class="fas fa-exclamation-circle" style="color:#e74c3c"></i>';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-message" style="font-weight:500; color:#333;">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
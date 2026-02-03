// expedicao/script.js

document.addEventListener('DOMContentLoaded', () => {
    injectCleanStyles(); 
    carregarPedidos();
    configurarBusca();
});

let debounceTimeout = null;

function configurarBusca() {
    const input = document.getElementById('input-busca');
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => carregarPedidos(e.target.value), 600);
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
            container.innerHTML = '<div style="padding:40px; text-align:center;">Nenhum pedido encontrado.</div>';
            return;
        }
        container.innerHTML = '';
        pedidos.forEach(p => container.appendChild(criarLinhaPedido(p)));
    } catch (err) {
        container.innerHTML = 'Erro ao carregar lista.';
    }
}

function criarLinhaPedido(p) {
    const div = document.createElement('div');
    div.className = 'exp-item grid-layout';
    const isEntregue = p.status_expedicao === 'Entregue';
    div.innerHTML = `
        <div style="font-weight:700;">${p.titulo}</div>
        <div>${p.nome_cliente}</div>
        <div style="text-align:center;">
            <span class="badge-status ${isEntregue ? 'st-entregue' : 'st-aguardando'}">${p.status_expedicao}</span>
        </div>
        <div style="text-align:right;"><i class="fas fa-chevron-right"></i></div>
    `;
    div.addEventListener('click', () => abrirGaveta(p));
    return div;
}

function abrirGaveta(p) {
    const overlay = document.getElementById('drawer-overlay');
    const panel = document.getElementById('drawer-panel');

    document.getElementById('drawer-header-title').innerText = p.titulo;
    document.getElementById('d-cliente').innerText = p.nome_cliente;
    document.getElementById('d-wpp').innerText = p.whatsapp;
    document.getElementById('d-briefing').innerText = p.briefing || 'Sem detalhes.';
    document.getElementById('d-status').innerText = p.status_expedicao;

    // --- FORMATAÇÃO FINANCEIRA ---
    const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('d-valor-pago').innerText = f.format(p.valor_pago || 0);
    document.getElementById('d-valor-restante').innerText = f.format(p.valor_restante || 0);

    // Link WhatsApp
    const btnWpp = document.getElementById('btn-wpp-link');
    if(p.whatsapp && p.whatsapp.length > 5) {
        btnWpp.href = `https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`;
        btnWpp.style.display = 'inline-block';
    } else { btnWpp.style.display = 'none'; }

    configurarBotaoAcao(p);
    overlay.classList.add('active');
    panel.classList.add('active');
}

function configurarBotaoAcao(p) {
    const btnAcao = document.getElementById('btn-gaveta-entregar');
    const isEntregue = p.status_expedicao === 'Entregue';
    
    btnAcao.dataset.confirming = "false";
    btnAcao.classList.remove('btn-confirm-state');

    if (isEntregue) {
        btnAcao.innerHTML = 'PEDIDO ENTREGUE';
        btnAcao.className = 'btn-entregar-lg btn-acao-entregue';
        btnAcao.disabled = true;
    } else {
        btnAcao.innerHTML = 'MARCAR COMO ENTREGUE';
        btnAcao.className = 'btn-entregar-lg btn-acao-entregar';
        btnAcao.disabled = false;
        btnAcao.onclick = () => {
            if (btnAcao.dataset.confirming === "true") {
                marcarEntregue(p.id_interno, btnAcao);
            } else {
                btnAcao.dataset.confirming = "true";
                btnAcao.innerHTML = 'CLIQUE NOVAMENTE PARA CONFIRMAR';
                btnAcao.classList.add('btn-confirm-state');
                setTimeout(() => {
                    btnAcao.dataset.confirming = "false";
                    btnAcao.innerHTML = 'MARCAR COMO ENTREGUE';
                    btnAcao.classList.remove('btn-confirm-state');
                }, 3000);
            }
        };
    }
}

function fecharGaveta() {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('drawer-panel').classList.remove('active');
}

async function marcarEntregue(idInterno, btnElement) {
    try {
        const res = await fetch('/api/expedicao/entregar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), id: idInterno })
        });
        if (res.ok) {
            fecharGaveta();
            showToast('Entregue com sucesso!');
            carregarPedidos(document.getElementById('input-busca').value);
        }
    } catch (err) { showToast('Erro ao atualizar', 'error'); }
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
    toast.innerHTML = `<div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function injectCleanStyles() { /* Mantido igual ao original */ }
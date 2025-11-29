// expedicao/script.js

document.addEventListener('DOMContentLoaded', () => {
    carregarPedidos();
    configurarBusca();
});

let debounceTimeout = null;
let pedidoSelecionadoId = null;

// --- BUSCA E LISTAGEM ---
function configurarBusca() {
    const input = document.getElementById('input-busca');
    input.addEventListener('input', (e) => {
        const termo = e.target.value;
        
        // Debounce para não chamar API a cada tecla (espera 500ms)
        clearTimeout(debounceTimeout);
        const container = document.getElementById('lista-expedicao');
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;"><i class="fas fa-search"></i> Filtrando...</div>';
        
        debounceTimeout = setTimeout(() => {
            carregarPedidos(termo);
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
        pedidos.forEach(p => {
            const el = criarLinhaPedido(p);
            container.appendChild(el);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="padding:20px; color:red; text-align:center;">Erro ao carregar lista.</div>';
    }
}

function criarLinhaPedido(p) {
    const div = document.createElement('div');
    div.className = 'exp-item';
    
    // Status visual
    const status = p.status_expedicao || 'Aguardando Retirada';
    const isEntregue = status === 'Entregue';
    const badgeClass = isEntregue ? 'st-entregue' : 'st-aguardando';
    const iconClass = isEntregue ? 'fa-check' : 'fa-clock';

    div.innerHTML = `
        <div style="font-weight:700; color:#334155;">#${p.id}</div>
        <div style="font-weight:600;">${p.nome_cliente || 'Consumidor'}</div>
        <div style="color:#64748b; font-size:0.9rem;">${p.titulo_automatico || p.servico_tipo || 'Pedido Geral'}</div>
        <div style="text-align:center;">
            <span class="badge-status ${badgeClass}"><i class="fas ${iconClass}"></i> ${status}</span>
        </div>
        <div style="text-align:center;">
            <button class="btn-ver-item">Ver Detalhes</button>
        </div>
    `;

    // Evento de clique na linha toda
    div.addEventListener('click', (e) => {
        abrirModal(p);
    });

    return div;
}

// --- MODAL ---
function abrirModal(pedido) {
    pedidoSelecionadoId = pedido.id;
    const modal = document.getElementById('modal-expedicao');
    const content = document.getElementById('modal-info-content');
    const btn = document.getElementById('btn-acao-entregar');

    const status = pedido.status_expedicao || 'Aguardando Retirada';
    const isEntregue = status === 'Entregue';

    // Popular Dados
    content.innerHTML = `
        <div class="info-row"><span class="info-label">ID do Pedido:</span> <span class="info-value">#${pedido.id}</span></div>
        <div class="info-row"><span class="info-label">Cliente:</span> <span class="info-value">${pedido.nome_cliente}</span></div>
        <div class="info-row"><span class="info-label">WhatsApp:</span> <span class="info-value">${pedido.wpp_cliente || '-'}</span></div>
        <div class="info-row"><span class="info-label">Serviço:</span> <span class="info-value">${pedido.servico_tipo || '-'}</span></div>
        <div class="info-row"><span class="info-label">Valor:</span> <span class="info-value">R$ ${parseFloat(pedido.valor_orcamento||0).toFixed(2)}</span></div>
        <div class="info-row" style="border:none; margin-top:10px;">
            <span class="info-label">Status Atual:</span> 
            <span class="info-value" style="color:${isEntregue?'#15803d':'#c2410c'}">${status}</span>
        </div>
    `;

    // Configurar Botão
    if (isEntregue) {
        btn.innerHTML = '<i class="fas fa-check-circle"></i> JÁ ENTREGUE';
        btn.classList.add('btn-entregue-disabled');
        btn.disabled = true;
    } else {
        btn.innerHTML = '<i class="fas fa-box"></i> MARCAR COMO ENTREGUE';
        btn.classList.remove('btn-entregue-disabled');
        btn.disabled = false;
        btn.onclick = () => marcarEntregue(pedido.id);
    }

    modal.classList.add('active');
}

function fecharModal() {
    document.getElementById('modal-expedicao').classList.remove('active');
}

// --- AÇÃO ENTREGAR ---
async function marcarEntregue(id) {
    if (!confirm('Confirmar que o produto foi entregue ao cliente?')) return;

    const btn = document.getElementById('btn-acao-entregar');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/expedicao/entregar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sessionToken: localStorage.getItem('sessionToken'),
                id: id 
            })
        });

        if (res.ok) {
            showToast('Pedido marcado como Entregue!', 'success');
            fecharModal();
            carregarPedidos(document.getElementById('input-busca').value); // Recarrega lista mantendo busca
        } else {
            throw new Error('Falha na API');
        }

    } catch (err) {
        showToast('Erro ao atualizar status.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-box"></i> MARCAR COMO ENTREGUE';
    }
}

// Toast Notification
function showToast(msg, type) {
    const container = document.querySelector('.toast-container');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.style.cssText = `background:white; padding:15px; margin-bottom:10px; border-left:5px solid ${type==='success'?'#2ecc71':'#e74c3c'}; border-radius:4px; box-shadow:0 5px 15px rgba(0,0,0,0.1); animation: slideIn 0.3s forwards; display:flex; gap:10px; align-items:center;`;
    div.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':'fa-exclamation-circle'}" style="color:${type==='success'?'#2ecc71':'#e74c3c'}"></i> <strong>${msg}</strong>`;
    
    if(!container) {
        const c = document.createElement('div');
        c.className = 'toast-container';
        c.style.cssText = "position:fixed; top:20px; right:20px; z-index:11000;";
        document.body.appendChild(c);
        c.appendChild(div);
    } else {
        container.appendChild(div);
    }

    setTimeout(() => div.remove(), 4000);
}

// Fechar modal ao clicar fora
document.getElementById('modal-expedicao').addEventListener('click', (e) => {
    if(e.target === document.getElementById('modal-expedicao')) fecharModal();
});
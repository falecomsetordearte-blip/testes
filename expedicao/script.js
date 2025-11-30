// expedicao/script.js

document.addEventListener('DOMContentLoaded', () => {
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
    div.className = 'exp-item';
    
    const isEntregue = p.status_expedicao === 'Entregue';
    const badgeClass = isEntregue ? 'st-entregue' : 'st-aguardando';
    const iconClass = isEntregue ? 'fa-check' : 'fa-clock';

    div.innerHTML = `
        <div style="font-weight:700; color:#334155;">#${p.id_bitrix}</div>
        <div style="font-weight:600;">${p.nome_cliente}</div>
        <div style="color:#64748b; font-size:0.9rem;">${p.titulo}</div>
        <div style="text-align:center;">
            <span class="badge-status ${badgeClass}"><i class="fas ${iconClass}"></i> ${p.status_expedicao}</span>
        </div>
        <div style="text-align:center;">
            <button class="btn-ver-item">Detalhes</button>
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
    document.getElementById('drawer-header-title').innerText = `Pedido #${p.id_bitrix}`;
    document.getElementById('d-cliente').innerText = p.nome_cliente;
    document.getElementById('d-titulo').innerText = p.titulo;
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

    // Botão de Ação
    const btnAcao = document.getElementById('btn-gaveta-entregar');
    if (isEntregue) {
        btnAcao.innerHTML = '<i class="fas fa-check-circle"></i> ENTREGUE EM ' + (p.data_entrega ? new Date(p.data_entrega).toLocaleDateString() : 'DATA N/D');
        btnAcao.className = 'btn-entregar-lg btn-acao-entregue';
        btnAcao.disabled = true;
    } else {
        btnAcao.innerHTML = '<i class="fas fa-box-open"></i> MARCAR COMO ENTREGUE';
        btnAcao.className = 'btn-entregar-lg btn-acao-entregar';
        btnAcao.disabled = false;
        
        // Verifica se temos o ID INTERNO para realizar o update
        if(p.id_interno) {
            btnAcao.onclick = () => marcarEntregue(p.id_interno);
        } else {
            btnAcao.innerHTML = 'Sincronização Pendente';
            btnAcao.disabled = true;
        }
    }

    overlay.classList.add('active');
    panel.classList.add('active');
}

function fecharGaveta() {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('drawer-panel').classList.remove('active');
}

async function marcarEntregue(idInterno) {
    if (!confirm('Confirmar entrega do produto?')) return;
    const btn = document.getElementById('btn-gaveta-entregar');
    btn.innerHTML = 'Processando...'; btn.disabled = true;

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
            carregarPedidos(document.getElementById('input-busca').value);
        } else {
            throw new Error('Falha na API');
        }
    } catch (err) {
        showToast('Erro ao atualizar.', 'error');
        btn.innerHTML = 'Tentar Novamente'; btn.disabled = false;
    }
}

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
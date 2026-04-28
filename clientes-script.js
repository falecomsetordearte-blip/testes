// /clientes-script.js
document.addEventListener("DOMContentLoaded", () => {
    carregarClientes();

    document.getElementById('search-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') buscarClientes();
    });
});

async function carregarClientes(busca = '') {
    const grid = document.getElementById('clientes-grid');
    const skeletonRow = `
        <tr class="skeleton-row">
            <td><div class="skeleton-line" style="width:60%;"></div></td>
            <td><div class="skeleton-line" style="width:80%;"></div></td>
            <td><div class="skeleton-line" style="width:40%; margin:0 auto;"></div></td>
            <td><div class="skeleton-line" style="width:50%; margin-left:auto;"></div></td>
            <td><div class="skeleton-line" style="width:30px; border-radius:50%;"></div></td>
        </tr>
    `;
    grid.innerHTML = skeletonRow + skeletonRow + skeletonRow + skeletonRow + skeletonRow;

    const token = localStorage.getItem('sessionToken');
    
    try {
        const response = await fetch('/api/clientes/listar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, query: busca })
        });

        if (!response.ok) throw new Error('Erro ao buscar clientes');
        const clientes = await response.json();

        if (clientes.length === 0) {
            grid.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 50px 20px; color: #64748b;">
                        <i class="fas fa-users-slash" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; display: block;"></i>
                        <strong>Nenhum cliente encontrado</strong>
                        <p style="margin: 5px 0 0; font-size: 0.85rem;">Tente buscar por outro nome ou número.</p>
                    </td>
                </tr>
            `;
            return;
        }

        grid.innerHTML = '';
        clientes.forEach(cliente => {
            const formatWpp = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, '') : '';
            const wppDisplay = formatWpp ? `(${formatWpp.substring(0,2)}) ${formatWpp.substring(2,7)}-${formatWpp.substring(7)}` : 'Não informado';
            
            const tr = document.createElement('tr');
            tr.onclick = () => abrirDetalhes(cliente.nome, formatWpp);
            
            tr.innerHTML = `
                <td>
                    <div class="cliente-nome-cell">
                        <div class="cliente-avatar"><i class="fas fa-user"></i></div>
                        <span class="cliente-nome-text">${cliente.nome}</span>
                    </div>
                </td>
                <td>
                    <div class="wpp-cell">
                        <i class="fab fa-whatsapp"></i>
                        ${wppDisplay}
                    </div>
                </td>
                <td style="text-align:center;">
                    <span class="badge-pedidos">${cliente.total_pedidos}</span>
                </td>
                <td style="text-align:right;">
                    <span class="valor-gasto">R$ ${parseFloat(cliente.total_gasto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </td>
                <td style="text-align:center;">
                    ${formatWpp ? `<a href="https://wa.me/55${formatWpp}" target="_blank" class="wpp-btn" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : ''}
                </td>
            `;
            grid.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro:", error);
        grid.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 20px; text-align:center;">Falha ao carregar os dados.</td></tr>`;
    }
}

function buscarClientes() {
    const busca = document.getElementById('search-input').value;
    carregarClientes(busca);
}

async function abrirDetalhes(nome, wpp) {
    document.getElementById('modal-nome-cliente').innerText = nome;
    document.getElementById('modal-wpp-cliente').innerText = wpp ? `(${wpp.substring(0,2)}) ${wpp.substring(2,7)}-${wpp.substring(7)}` : 'Não informado';
    
    const wppLink = document.getElementById('modal-wpp-link');
    if(wpp) {
        wppLink.style.display = 'inline-flex';
        wppLink.href = `https://wa.me/55${wpp}`;
    } else {
        wppLink.style.display = 'none';
    }

    document.getElementById('modal-detalhes').classList.add('active');
    
    const lista = document.getElementById('historico-list');
    lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Carregando histórico... <i class="fas fa-spinner fa-spin"></i></li>';

    const token = localStorage.getItem('sessionToken');

    try {
        const response = await fetch('/api/clientes/detalhes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, nome: nome })
        });

        if (!response.ok) throw new Error('Erro ao carregar detalhes');
        const pedidos = await response.json();

        lista.innerHTML = '';
        if (pedidos.length === 0) {
            lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Nenhum pedido encontrado.</li>';
            return;
        }

        pedidos.forEach(p => {
            const totalPago = parseFloat(p.valor_pago || 0) + parseFloat(p.valor_restante || 0);
            const dataPed = new Date(p.created_at).toLocaleDateString('pt-BR');
            
            let corEtapa = '#4f46e5';
            let bgEtapa = '#e0e7ff';
            if (p.etapa === 'CONCLUÍDO') { corEtapa = '#10b981'; bgEtapa = '#d1fae5'; }
            if (p.etapa === 'CANCELADO') { corEtapa = '#ef4444'; bgEtapa = '#fee2e2'; }
            
            lista.innerHTML += `
                <li class="pedido-item">
                    <div class="pedido-info">
                        <div class="pedido-titulo">${p.titulo || `Pedido #${p.id}`}</div>
                        <div class="pedido-data"><i class="far fa-calendar-alt"></i> ${dataPed}</div>
                    </div>
                    <div class="pedido-etapa" style="color: ${corEtapa}; background: ${bgEtapa};">
                        ${p.etapa}
                    </div>
                    <div class="pedido-valor">R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </li>
            `;
        });

    } catch (error) {
        lista.innerHTML = `<li style="text-align:center; padding:20px; color:#ef4444;">Erro ao carregar histórico.</li>`;
    }
}

function fecharModal() {
    document.getElementById('modal-detalhes').classList.remove('active');
}

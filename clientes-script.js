// /clientes-script.js
let segmentosCache = [];

document.addEventListener("DOMContentLoaded", () => {
    carregarClientes();
    carregarSegmentos(); // Cache inicial dos segmentos

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
            <td><div class="skeleton-line" style="width:100px;"></div></td>
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
                    <td colspan="6" style="text-align: center; padding: 50px 20px; color: #64748b;">
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
            
            // Renderizar tags
            const tagsHtml = (cliente.tags || []).map(t => 
                `<span class="tag-badge" style="background: ${t.cor || '#3b82f6'}">${t.nome}</span>`
            ).join('');

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
                <td>
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                        ${tagsHtml}
                        <button class="btn-add-tag" onclick="event.stopPropagation(); abrirModalAplicarTag(${cliente.id || 0}, '${cliente.nome.replace(/'/g, "\\'") }', ${JSON.stringify((cliente.tags || []).map(t => t.id))})" title="Adicionar Tag">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </td>
                <td style="text-align:right;">
                    <span class="valor-gasto">R$ ${parseFloat(cliente.total_gasto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </td>
                <td style="text-align:center; white-space: nowrap;">
                    <button class="wpp-btn" style="background: #f1f5f9; color: #64748b; margin-right: 6px;" onclick="event.stopPropagation(); abrirModalEditar('${cliente.nome.replace(/'/g, "\\'") }', '${formatWpp}')" title="Editar cliente">
                        <i class="fas fa-edit" style="font-size: 0.85rem;"></i>
                    </button>
                    ${formatWpp ? `<a href="https://wa.me/55${formatWpp}" target="_blank" class="wpp-btn" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : ''}
                </td>
            `;
            grid.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro:", error);
        grid.innerHTML = `<tr><td colspan="6" style="color: #ef4444; padding: 20px; text-align:center;">Falha ao carregar os dados.</td></tr>`;
    }
}

function buscarClientes() {
    const busca = document.getElementById('search-input').value;
    carregarClientes(busca);
}

// MODAIS
function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}

function abrirModalNovoCliente() {
    document.getElementById('form-novo-cliente').reset();
    document.getElementById('modal-novo-cliente').classList.add('active');
}

// EDITAR CLIENTE
function abrirModalEditar(nome, wpp) {
    document.getElementById('editar-nome').value = nome;
    document.getElementById('editar-wpp').value = wpp;
    document.getElementById('editar-wpp-original').value = wpp;
    document.getElementById('modal-editar-cliente').classList.add('active');
}

async function salvarEdicaoCliente(e) {
    e.preventDefault();
    const nome = document.getElementById('editar-nome').value.trim();
    const whatsapp = document.getElementById('editar-wpp').value.replace(/\D/g, '');
    const token = localStorage.getItem('sessionToken');

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const response = await fetch('/api/clientes/cadastrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, nome, whatsapp })
        });

        if (!response.ok) throw new Error('Erro ao salvar');
        
        fecharModal('modal-editar-cliente');
        carregarClientes();
    } catch (error) {
        alert('Erro ao salvar edição do cliente.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
    }
}

async function salvarNovoCliente(e) {
    e.preventDefault();
    const nome = document.getElementById('novo-nome').value;
    const whatsapp = document.getElementById('novo-wpp').value.replace(/\D/g, '');
    const token = localStorage.getItem('sessionToken');

    try {
        const response = await fetch('/api/clientes/cadastrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, nome, whatsapp })
        });

        if (!response.ok) throw new Error('Erro ao cadastrar');
        
        fecharModal('modal-novo-cliente');
        carregarClientes();
        alert('Cliente cadastrado com sucesso!');
    } catch (error) {
        alert('Erro ao cadastrar cliente');
    }
}

// GESTÃO DE SEGMENTOS (TAGS)
async function carregarSegmentos() {
    const token = localStorage.getItem('sessionToken');
    try {
        const response = await fetch('/api/clientes/segmentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, action: 'list' })
        });
        if (response.ok) {
            segmentosCache = await response.json();
        }
    } catch (error) {
        console.error("Erro ao carregar segmentos:", error);
    }
}

async function abrirModalSegmentos() {
    await carregarSegmentos();
    const lista = document.getElementById('lista-segmentos-gestao');
    lista.innerHTML = '';
    
    segmentosCache.forEach(s => {
        lista.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${s.cor || '#3b82f6'}"></div>
                    <span style="font-weight: 500; font-size: 0.9rem;">${s.nome}</span>
                </div>
                <button onclick="excluirSegmento(${s.id})" style="background: none; border: none; color: #94a3b8; cursor: pointer; transition: 0.2s;"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
    });
    
    document.getElementById('modal-segmentos').classList.add('active');
}

async function criarSegmento() {
    const nome = document.getElementById('input-novo-segmento').value;
    if (!nome) return;
    
    const token = localStorage.getItem('sessionToken');
    try {
        const response = await fetch('/api/clientes/segmentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, action: 'create', nome })
        });
        if (response.ok) {
            document.getElementById('input-novo-segmento').value = '';
            abrirModalSegmentos();
            carregarClientes(); // Recarrega para refletir se precisar
        }
    } catch (error) {
        alert('Erro ao criar segmento');
    }
}

async function excluirSegmento(id) {
    if (!confirm('Tem certeza que deseja excluir este segmento? Ele será removido de todos os clientes.')) return;
    
    const token = localStorage.getItem('sessionToken');
    try {
        await fetch('/api/clientes/segmentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, action: 'delete', id })
        });
        abrirModalSegmentos();
        carregarClientes();
    } catch (error) {
        alert('Erro ao excluir');
    }
}

// APLICAR TAG AO CLIENTE
async function abrirModalAplicarTag(clienteId, nomeCliente, tagsAtuaisIds) {
    document.getElementById('tag-nome-cliente').innerText = nomeCliente;
    const lista = document.getElementById('lista-tags-disponiveis');
    lista.innerHTML = '';
    
    if (segmentosCache.length === 0) await carregarSegmentos();
    
    segmentosCache.forEach(s => {
        const checked = tagsAtuaisIds.includes(s.id) ? 'checked' : '';
        lista.innerHTML += `
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0;">
                <input type="checkbox" ${checked} onchange="toggleTag(${clienteId}, ${s.id}, this.checked)">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: ${s.cor || '#3b82f6'}"></div>
                <span style="font-size: 0.9rem;">${s.nome}</span>
            </label>
        `;
    });
    
    document.getElementById('modal-aplicar-tag').classList.add('active');
}

async function toggleTag(clienteId, segmentoId, add) {
    const token = localStorage.getItem('sessionToken');
    try {
        await fetch('/api/clientes/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionToken: token, 
                action: add ? 'add' : 'remove', 
                clienteId, 
                segmentoId 
            })
        });
        carregarClientes(); // Atualiza a lista para mostrar a nova tag
    } catch (error) {
        console.error("Erro ao alterar tag:", error);
    }
}

// DETALHES EXISTENTES
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

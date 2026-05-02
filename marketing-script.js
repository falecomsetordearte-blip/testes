// /marketing-script.js
let segmentosCache = [];

document.addEventListener("DOMContentLoaded", () => {
    carregarConfigGoogle();
    carregarMensagens();
    carregarSegmentos();
});

async function carregarConfigGoogle() {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    try {
        const response = await fetch('/api/marketing/google-review', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('google-review-link').value = data.google_review_link || '';
            document.getElementById('google-review-message').value = data.google_review_message || '';
        }
    } catch (error) {
        console.error("Erro ao carregar config google:", error);
    }
}

async function salvarConfigGoogle(e) {
    e.preventDefault();
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    const btn = document.getElementById('btn-save-google');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    const link = document.getElementById('google-review-link').value;
    const message = document.getElementById('google-review-message').value;

    try {
        const response = await fetch('/api/marketing/google-review', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ link, message })
        });
        const data = await response.json();
        
        if (response.ok) {
            btn.style.background = '#10b981';
            btn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
            setTimeout(() => {
                btn.style.background = '#4f46e5';
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }, 2000);
        } else {
            throw new Error(data.message || 'Erro ao salvar');
        }
    } catch (error) {
        alert(error.message);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

async function carregarMensagens() {
    const container = document.getElementById('mensagens-container');
    container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#4f46e5;"></i></div>';

    const token = localStorage.getItem('sessionToken');
    
    try {
        const response = await fetch('/api/marketing/mensagens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, action: 'list' })
        });

        if (!response.ok) throw new Error('Erro ao buscar mensagens');
        const mensagens = await response.json();

        if (mensagens.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-magic" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.3;"></i>
                    <p>Você ainda não criou nenhuma mensagem para o seu funil.</p>
                    <button onclick="abrirModalMensagem()" style="margin-top: 15px; background: #4f46e5; color: white; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer;">Começar Agora</button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        mensagens.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'message-card';
            
            // Mapear nomes de segmentos
            let tagsHtml = '';
            let segmentosAlvo = msg.segmentos_alvo;
            if (typeof segmentosAlvo === 'string') segmentosAlvo = JSON.parse(segmentosAlvo);
            
            if (segmentosAlvo && segmentosAlvo.length > 0) {
                tagsHtml = segmentosAlvo.map(id => {
                    const s = segmentosCache.find(seg => seg.id == id);
                    return s ? `<span class="tag-badge" style="background: ${s.cor || '#3b82f6'}">${s.nome}</span>` : '';
                }).join('');
            } else {
                tagsHtml = '<span class="tag-badge" style="background: #94a3b8">Todos os Clientes</span>';
            }

            card.innerHTML = `
                <div class="message-order">
                    <span>Etapa</span>
                    ${msg.ordem}
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-delay">
                            <i class="far fa-clock"></i> Esperar ${msg.delay_horas} horas
                        </div>
                        <div class="message-actions">
                            <button class="btn-action" onclick="editarMensagem(${JSON.stringify(msg).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            <button class="btn-action delete" onclick="excluirMensagem(${msg.id})"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="message-text">${msg.texto}</div>
                    <div class="message-tags">
                        ${tagsHtml}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Erro:", error);
        container.innerHTML = `<div class="empty-state" style="color:#ef4444;">Erro ao carregar o funil. Verifique sua conexão.</div>`;
    }
}

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
            renderizarSeletorTags();
        }
    } catch (error) {
        console.error("Erro ao carregar segmentos:", error);
    }
}

function renderizarSeletorTags() {
    const container = document.getElementById('tags-selector');
    if (!container) return;
    
    container.innerHTML = '';
    segmentosCache.forEach(s => {
        container.innerHTML += `
            <label class="tag-option">
                <input type="checkbox" name="segmentos_ids" value="${s.id}">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${s.cor || '#3b82f6'}"></div>
                ${s.nome}
            </label>
        `;
    });
}

function fecharModal() {
    document.getElementById('modal-mensagem').classList.remove('active');
}

function abrirModalMensagem() {
    document.getElementById('form-mensagem').reset();
    document.getElementById('msg-id').value = '';
    document.getElementById('modal-titulo').innerText = 'Adicionar Mensagem ao Funil';
    
    // Desmarcar todos os checkboxes
    const checks = document.querySelectorAll('input[name="segmentos_ids"]');
    checks.forEach(c => c.checked = false);
    
    document.getElementById('modal-mensagem').classList.add('active');
}

function editarMensagem(msg) {
    document.getElementById('msg-id').value = msg.id;
    document.getElementById('msg-texto').value = msg.texto;
    document.getElementById('msg-delay').value = msg.delay_horas;
    document.getElementById('msg-ordem').value = msg.ordem;
    document.getElementById('modal-titulo').innerText = 'Editar Mensagem';
    
    let alvos = msg.segmentos_alvo;
    if (typeof alvos === 'string') alvos = JSON.parse(alvos);
    
    const checks = document.querySelectorAll('input[name="segmentos_ids"]');
    checks.forEach(c => {
        c.checked = alvos ? alvos.includes(parseInt(c.value)) : false;
    });
    
    document.getElementById('modal-mensagem').classList.add('active');
}

async function salvarMensagem(e) {
    e.preventDefault();
    const token = localStorage.getItem('sessionToken');
    const id = document.getElementById('msg-id').value;
    const texto = document.getElementById('msg-texto').value;
    const delay_horas = parseInt(document.getElementById('msg-delay').value);
    const ordem = parseInt(document.getElementById('msg-ordem').value);
    
    const checks = document.querySelectorAll('input[name="segmentos_ids"]:checked');
    const segmentos_alvo = Array.from(checks).map(c => parseInt(c.value));

    const payload = {
        sessionToken: token,
        action: id ? 'update' : 'create',
        id: id || undefined,
        texto,
        delay_horas,
        ordem,
        segmentos_alvo: segmentos_alvo.length > 0 ? segmentos_alvo : null,
        ativo: true
    };

    try {
        const response = await fetch('/api/marketing/mensagens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Erro ao salvar');
        
        fecharModal();
        carregarMensagens();
    } catch (error) {
        alert('Erro ao salvar mensagem');
    }
}

async function excluirMensagem(id) {
    if (!confirm('Deseja realmente remover esta mensagem do funil?')) return;
    
    const token = localStorage.getItem('sessionToken');
    try {
        await fetch('/api/marketing/mensagens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, action: 'delete', id })
        });
        carregarMensagens();
    } catch (error) {
        alert('Erro ao excluir');
    }
}

async function testarFunil() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    const token = localStorage.getItem('sessionToken');
    try {
        const response = await fetch('/api/cron/processarFunil', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token })
        });
        const data = await response.json();
        alert(data.message || 'Funil processado com sucesso!');
    } catch (error) {
        alert('Erro ao rodar o funil.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

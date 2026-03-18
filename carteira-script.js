// carteira-script.js

let dadosExtratoAtual = []; 

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosCarteira();
    carregarAcertosGrafica();
});

const fmtMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = type === 'success' ? `<i class="fas fa-check"></i> ${message}` : `<i class="fas fa-times"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

window.abrirModalRecarga = () => document.getElementById('modal-recarga').classList.add('active');
window.abrirModalAnalise = () => document.getElementById('modal-analise').classList.add('active');
window.fecharModal = (id) => document.getElementById(id).classList.remove('active');

function configurarMascaras() {
    const cnpj = document.getElementById('input-cnpj');
    if (cnpj) IMask(cnpj, { mask: '00.000.000/0000-00' });
    const valor = document.getElementById('input-valor-recarga');
    if (valor) IMask(valor, { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' });
    const fat = document.getElementById('input-faturamento');
    if(fat) IMask(fat, { mask: 'R$ num', blocks: { num: { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' }}});
}

async function carregarDadosCarteira() {
    const token = localStorage.getItem('sessionToken');
    if(!token) return window.location.href = '/login.html';

    try {
        const res = await fetch('/api/carteira/dados', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token })
        });
        if(!res.ok) throw new Error('Erro');
        const data = await res.json();

        document.getElementById('val-atrasado').innerText = fmtMoeda(data.atrasado);
        document.getElementById('val-pendente').innerText = fmtMoeda(data.pendente);
        document.getElementById('val-pago').innerText = fmtMoeda(data.pago_mes);

    } catch (err) { console.error(err); }
}

window.carregarAcertosGrafica = async function() {
    const token = localStorage.getItem('sessionToken');
    const statusFilter = document.getElementById('filtro-status').value;
    const lista = document.getElementById('lista-acertos');

    lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Buscando...</li>';

    try {
        const res = await fetch('/api/carteira/extrato', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token, statusFilter })
        });
        if(!res.ok) throw new Error('Erro');
        const responseData = await res.json();
        const acertos = responseData.extrato || [];
        lista.innerHTML = '';

        if (acertos.length === 0) {
            lista.innerHTML = '<li style="text-align:center; padding:20px;">Nenhum acerto encontrado.</li>';
            return;
        }

        acertos.forEach(item => {
            const li = document.createElement('li');
            li.style.cssText = "display: grid; grid-template-columns: 1fr 2.5fr 1fr 1fr 1fr; gap: 10px; padding: 15px 10px; border-bottom: 1px solid #f1f5f9; align-items: center;";
            
            const date = new Date(item.data).toLocaleDateString('pt-BR');
            const valorFmt = parseFloat(item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            let badgeClass = 'badge-entrada';
            let statusText = item.status;
            let botaoAcao = '';

            if (item.status === 'PENDENTE') { 
                badgeClass = 'badge-producao'; 
                statusText = 'A Pagar'; 
                botaoAcao = `<button onclick="abrirModalPix(${item.id}, '${item.designer_nome}', '${item.designer_pix}', ${item.valor})" class="btn-action-sm" style="background:#27ae60; color:white; padding:6px 12px; border:none; border-radius:6px; cursor:pointer;"><i class="fas fa-qrcode"></i> Pagar</button>`;
            } else if (item.status === 'PAGO_INFORMADO') { 
                badgeClass = 'badge-entrada'; 
                statusText = 'Aguardando Confirmação'; 
                botaoAcao = '<span style="font-size:0.8rem; color:#64748b;">Em análise</span>';
            } else if (item.status === 'PAGO') { 
                badgeClass = 'badge-finalizado'; 
                statusText = 'Pago'; 
                botaoAcao = item.comprovante ? `<a href="${item.comprovante}" target="_blank" style="font-size:0.8rem; color:#3498db; text-decoration:none;"><i class="fas fa-receipt"></i> Recibo</a>` : '<span style="font-size:0.8rem; color:#27ae60;"><i class="fas fa-check"></i> Concluído</span>';
            }

            li.innerHTML = `
                <div style="font-size:0.85rem; color:#64748b;">${date}</div>
                <div>
                    <strong style="color:#2d3748;">${item.designer_nome}</strong><br>
                    <span style="font-size: 0.8rem; color: #64748b;">Arte: ${item.descricao} (#${item.deal_id})</span>
                </div>
                <div><span class="badge-status ${badgeClass}">${statusText}</span></div>
                <div style="font-weight:700; color:var(--text-main); text-align:right;">${valorFmt}</div>
                <div style="text-align:center;">${botaoAcao}</div>
            `;
            lista.appendChild(li);
        });
    } catch (err) { lista.innerHTML = '<li style="text-align:center; color:red;">Erro ao carregar acertos.</li>'; }
}

window.abrirModalPix = (acertoId, nome, chavePix, valor) => {
    document.getElementById('input-acerto-id').value = acertoId;
    document.getElementById('pix-nome-designer').textContent = nome;
    document.getElementById('pix-chave-designer').textContent = chavePix;
    document.getElementById('pix-valor-cobrado').textContent = fmtMoeda(valor);
    
    document.getElementById('modal-pagamento-pix').classList.add('active');
};

window.exportarCSV = function() {
    if (!dadosExtratoAtual.length) return showToast('Sem dados para exportar.', 'error');
    const headers = ["Data", "Pedido", "Descricao", "Status", "Valor", "Tipo", "Link"];
    const rows = dadosExtratoAtual.map(row => {
        const d = new Date(row.data).toLocaleDateString('pt-BR');
        const desc = (row.descricao||'').replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
        const val = Math.abs(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        return [d, row.deal_id, `"${desc}"`, row.status, val, row.tipo, row.link_atendimento||''];
    });
    const csvContent = [headers.join(";"), ...rows.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

    document.getElementById('form-confirmar-pix-grafica').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-comprovante');
        const acertoId = document.getElementById('input-acerto-id').value;
        const comprovanteUrl = document.getElementById('input-comprovante-url').value.trim();

        btn.disabled = true; 
        btn.textContent = 'Enviando...';

        try {
            const token = localStorage.getItem('sessionToken');
            const res = await fetch('/api/carteira/informarPagamento', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ token, acertoId, comprovanteUrl }) 
            });
            const data = await res.json();
            
            if(!res.ok) throw new Error(data.message);
            
            fecharModal('modal-pagamento-pix'); 
            showToast('Pagamento informado com sucesso. O designer receberá uma notificação para validar.', 'success'); 
            
            carregarDadosCarteira();
            carregarAcertosGrafica();

        } catch (err) { 
            showToast(err.message, 'error'); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Informar Pagamento Enviado'; 
        }
    });
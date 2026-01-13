// /instalacao/painel-script.js - VERSÃO COM OVERLAP E EDIÇÃO MANUAL

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        // --- CONSTANTES ---
        const LAYOUT_FIELD = 'UF_CRM_1764124589418';
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';
        
        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };

        // Elementos DOM
        const boardKanban = document.getElementById('view-kanban');
        const boardCalendar = document.getElementById('view-calendar');
        const btnViewKanban = document.getElementById('btn-view-kanban');
        const btnViewCalendar = document.getElementById('btn-view-calendar');

        // Modais
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        const modalAgendamento = document.getElementById('modal-agendamento');
        const inputInstaladores = document.getElementById('input-instaladores');
        const inputDuracao = document.getElementById('input-duracao');
        const inputDiaInicio = document.getElementById('input-dia-inicio');
        const inputHoraInicio = document.getElementById('input-hora-inicio');
        const btnSalvarAgendamento = document.getElementById('btn-salvar-agendamento');
        
        let currentEditingDealId = null;
        let allDealsData = [];
        let allSchedules = []; 
        
        // Configurações Calendário
        const CALENDAR_START_HOUR = 8;
        const CALENDAR_END_HOUR = 18;
        const PIXELS_PER_HOUR = 80; // Ajustado para caber melhor na tela

        // --- CSS CLEAN & OVERLAP ---
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary: #3498db; --success: #2ecc71; --danger: #e74c3c;
                --text-dark: #2c3e50; --bg-card: #ffffff;
            }
            /* Globais */
            .kanban-header { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; margin-bottom: 20px; }
            .view-switcher { display: flex; gap: 10px; background: #fff; padding: 5px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .view-switcher button { border: none; background: transparent; padding: 8px 15px; cursor: pointer; border-radius: 6px; font-weight: 600; color: #7f8c8d; transition: all 0.2s; }
            .view-switcher button.active { background: var(--primary); color: white; }
            .hidden { display: none !important; }

            /* Kanban */
            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; }
            .kanban-column { background: transparent; min-width: 280px; max-width: 320px; display: flex; flex-direction: column; max-height: 80vh; }
            .column-header { font-weight: 700; color: white; margin-bottom: 15px; text-transform: uppercase; font-size: 0.9rem; padding: 10px 15px; border-radius: 6px; text-align: center; }
            .status-atrasado .column-header { background-color: var(--danger); }
            .status-hoje .column-header { background-color: #f1c40f; color: #333; }
            .status-esta-semana .column-header { background-color: #2980b9; }
            .status-proxima-semana .column-header { background-color: #8e44ad; }
            .status-sem-data .column-header { background-color: #95a5a6; }
            .column-cards { overflow-y: auto; flex-grow: 1; min-height: 100px; padding-right: 5px; }
            .kanban-card { background: var(--bg-card); border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 5px solid var(--primary); cursor: pointer; position: relative; transition: transform 0.2s; }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .btn-detalhes-visual { width: 100%; background: #f4f6f9; border: 1px solid #e1e1e1; padding: 5px; border-radius: 4px; text-align: center; font-size: 0.8rem; margin-top: 10px; }

            /* Calendário */
            .calendar-container { display: flex; height: calc(100vh - 140px); gap: 20px; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.05); border: 1px solid #ddd; }
            .calendar-sidebar { width: 220px; background: #f9f9f9; padding: 15px; border-right: 1px solid #eee; display: flex; flex-direction: column; }
            .calendar-sidebar h3 { font-size: 1rem; margin: 0 0 5px 0; color: var(--text-dark); }
            .backlog-list { flex-grow: 1; overflow-y: auto; padding-right: 5px; }
            .backlog-card { background: white; padding: 10px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #ddd; cursor: grab; font-size: 0.85rem; border-left: 3px solid #999; }
            
            .calendar-main { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
            .calendar-header-dates { display: grid; grid-template-columns: 50px repeat(5, 1fr); background: #f4f6f9; border-bottom: 1px solid #ddd; height: 50px; flex-shrink: 0; }
            .cal-header-cell { display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--text-dark); border-right: 1px solid #ddd; flex-direction: column; line-height: 1.2; font-size: 0.9rem; }
            .cal-header-cell.today { background-color: #e3f2fd; color: var(--primary); }
            
            .calendar-grid-body { display: flex; flex-grow: 1; overflow-y: auto; position: relative; }
            .time-labels { width: 50px; flex-shrink: 0; background: #fff; border-right: 1px solid #ddd; }
            .time-labels div { height: ${PIXELS_PER_HOUR}px; border-bottom: 1px solid transparent; font-size: 0.75rem; color: #999; text-align: right; padding-right: 5px; transform: translateY(-50%); padding-top: 5px; }
            
            .day-columns-wrapper { display: grid; grid-template-columns: repeat(5, 1fr); flex-grow: 1; position: relative; background: repeating-linear-gradient(to bottom, transparent 0, transparent ${PIXELS_PER_HOUR - 1}px, #f0f0f0 ${PIXELS_PER_HOUR}px); background-size: 100% ${PIXELS_PER_HOUR}px; }
            .day-column { border-right: 1px solid #eee; position: relative; height: ${(CALENDAR_END_HOUR - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px; }
            .day-column.droppable-hover { background-color: rgba(52, 152, 219, 0.1); }

            /* Eventos no Calendário */
            .calendar-event { 
                position: absolute; 
                background: #e3f2fd; border-left: 3px solid var(--primary); 
                border-radius: 4px; padding: 4px; font-size: 0.8rem; 
                overflow: hidden; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                display: flex; flex-direction: column; z-index: 10;
                transition: all 0.2s;
                /* Overlap properties will be set inline */
            }
            .calendar-event:hover { z-index: 50; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transform: scale(1.02); }
            .event-time { font-weight: 700; color: var(--primary); font-size: 0.7rem; margin-bottom: 1px; }
            .event-title { font-weight: 600; color: #333; line-height: 1.1; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .event-tags { margin-top: auto; padding-top: 2px; display: flex; gap: 2px; flex-wrap: wrap; }
            .tag-installer { background: #333; color: white; border-radius: 3px; padding: 1px 3px; font-size: 0.6rem; }
            .btn-edit-event { position: absolute; top: 2px; right: 2px; border: none; background: none; color: #999; cursor: pointer; font-size: 0.8rem; z-index: 2; }
            .btn-edit-event:hover { color: var(--primary); }

            /* Agulha */
            .current-time-line { position: absolute; width: 100%; border-top: 2px solid red; z-index: 100; pointer-events: none; }
            .current-time-circle { width: 8px; height: 8px; background: red; border-radius: 50%; position: absolute; left: -4px; top: -5px; }

            /* Toasts e Modais */
            .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; }
            .toast { background: white; padding: 12px 20px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-left: 4px solid #ccc; animation: slideIn 0.3s; }
            .toast.success { border-left-color: var(--success); }
            .toast.error { border-left-color: var(--danger); }
            @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 9999; }
            .modal-overlay.active { display: flex; }
            .modal-content { background: white; width: 90%; max-width: 500px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; border: none; }
            .modal-content.modal-lg { max-width: 900px; }
            .modal-header { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; }
            .modal-body { padding: 20px; max-height: 80vh; overflow-y: auto; }
            .close-modal { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
            
            /* Detalhes específicos */
            .detalhe-layout { display: grid; grid-template-columns: 60% 38%; gap: 2%; min-height: 300px; }
            .detalhe-col-principal { background: #f8f9fa; display: flex; align-items: center; justify-content: center; border: 2px dashed #eee; padding: 5px; }
            .layout-img { max-width: 100%; max-height: 400px; object-fit: contain; }
            .btn-acao-modal { display: block; width: 100%; padding: 10px; margin-bottom: 5px; text-align: center; border-radius: 4px; text-decoration: none; font-size: 0.9rem; }
            .btn-acao-modal.principal { background: var(--primary); color: white; }
            .btn-acao-modal.secundario { background: #eee; color: #333; }
        `;
        document.head.appendChild(style);

        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            toastContainer.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        // --- CARREGAMENTO DE DADOS ---
        async function loadAllData() {
            try {
                // 1. Pedidos do Bitrix
                const resDeals = await fetch('/api/instalacao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });
                const dataDeals = await resDeals.json();
                allDealsData = dataDeals.deals || [];

                // 2. Agendamentos do Neon
                const resSchedule = await fetch('/api/instalacao/getSchedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}) 
                });
                const dataSchedule = await resSchedule.json();
                allSchedules = dataSchedule.schedules || [];

                renderKanban();
                renderCalendar();

            } catch (error) {
                console.error(error);
                showToast("Erro ao carregar dados", "error");
            }
        }

        function getScheduleForDeal(dealId) {
            return allSchedules.find(s => s.bitrix_deal_id == dealId);
        }

        // --- RENDERIZADORES ---
        
        // 1. KANBAN (Padrão)
        function renderKanban() {
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '');
            allDealsData.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const prazoData = new Date(prazoFinalStr.split('T')[0]);
                    const hoje = new Date(); hoje.setHours(0,0,0,0);
                    const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else colunaId = 'PROXIMA_SEMANA';
                }

                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.dataset.dealId = deal.ID;
                card.innerHTML = `
                    <div style="font-size:0.75rem; color:#aaa; font-weight:700">#${deal.TITLE || deal.ID}</div>
                    <div style="font-weight:600; color:#333; margin-bottom:5px;">${deal[NOME_CLIENTE_FIELD] || 'Sem Nome'}</div>
                    <button class="btn-detalhes-visual"><i class="fa fa-eye"></i> Visualizar</button>
                `;
                card.querySelector('.btn-detalhes-visual').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openDetailsModal(deal.ID);
                });
                const col = document.getElementById(`cards-${colunaId}`);
                if (col) col.appendChild(card);
            });
        }

        // 2. CALENDÁRIO (Com Overlap Logic)
        function renderCalendar() {
            const backlogContainer = document.getElementById('calendar-backlog');
            const columnsContainer = document.getElementById('calendar-columns-container');
            const headerRow = document.getElementById('calendar-header-row');
            
            backlogContainer.innerHTML = '';
            columnsContainer.innerHTML = '';
            headerRow.innerHTML = '<div class="cal-header-cell"></div>'; // Espaço time labels

            // Definir Semana (Seg-Sex)
            const today = new Date();
            const dayOfWeek = today.getDay();
            const distToMonday = (dayOfWeek + 6) % 7; 
            const monday = new Date(today);
            monday.setDate(today.getDate() - distToMonday);

            const weekDays = [];
            for(let i=0; i<5; i++) {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                weekDays.push(d);
            }

            // Renderizar Colunas
            const dayColumnsEls = [];
            weekDays.forEach(date => {
                const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                const isToday = date.toDateString() === today.toDateString();
                
                // Header
                const headerCell = document.createElement('div');
                headerCell.className = `cal-header-cell ${isToday ? 'today' : ''}`;
                headerCell.innerHTML = `<span>${dateStr.split(',')[0]}</span><span style="font-size:0.8em">${dateStr.split(',')[1]}</span>`;
                headerRow.appendChild(headerCell);

                // Coluna
                const col = document.createElement('div');
                col.className = 'day-column';
                col.dataset.dateIso = date.toISOString().split('T')[0];
                col.addEventListener('dragover', handleDragOver);
                col.addEventListener('dragleave', handleDragLeave);
                col.addEventListener('drop', handleDropOnCalendar);
                
                if (isToday) addRedNeedle(col);
                
                columnsContainer.appendChild(col);
                dayColumnsEls.push({ element: col, dateIso: col.dataset.dateIso, events: [] });
            });

            // Distribuir Cards (Eventos vs Backlog)
            allDealsData.forEach(deal => {
                const schedule = getScheduleForDeal(deal.ID);
                
                // Card para o Backlog (usamos um clone para o evento)
                const backlogCard = createBacklogCardElement(deal);

                if (schedule && schedule.start_time) {
                    const start = new Date(schedule.start_time);
                    const dayObj = dayColumnsEls.find(d => d.dateIso === start.toISOString().split('T')[0]);

                    if (dayObj) {
                        // Está nessa semana -> Adiciona à lista da coluna para cálculo de overlap
                        dayObj.events.push({ deal, schedule });
                    } else {
                        // Agendado para outra semana
                        backlogCard.innerHTML += `<div style="color:orange; font-size:0.7rem"><i class="far fa-clock"></i> Outra semana</div>`;
                        backlogContainer.appendChild(backlogCard);
                    }
                } else {
                    // Sem agendamento
                    backlogContainer.appendChild(backlogCard);
                }
            });

            // Processar Overlaps e Renderizar Eventos em cada coluna
            dayColumnsEls.forEach(dayObj => {
                renderEventsWithOverlap(dayObj.element, dayObj.events);
            });
        }

        // LÓGICA DE OVERLAP (Resolve conflitos visuais)
        function renderEventsWithOverlap(columnEl, eventsList) {
            if (eventsList.length === 0) return;

            // 1. Ordenar por horário de início
            eventsList.sort((a, b) => new Date(a.schedule.start_time) - new Date(b.schedule.start_time));

            // 2. Calcular posições (Algoritmo de Colunas)
            // Mapeia minutos do dia (0 a 600) -> Array de eventos naquele minuto
            const minutesMap = new Array(660).fill(0); // 8:00 (0) as 19:00 (660)

            const placedEvents = eventsList.map(item => {
                const start = new Date(item.schedule.start_time);
                const end = new Date(item.schedule.end_time);
                
                // Converter para minutos relativos ao inicio (8:00)
                const startMin = (start.getHours() * 60 + start.getMinutes()) - (CALENDAR_START_HOUR * 60);
                let endMin = (end.getHours() * 60 + end.getMinutes()) - (CALENDAR_START_HOUR * 60);
                if (endMin <= startMin) endMin = startMin + 30; // Minimo visual
                
                return { ...item, startMin, endMin };
            });

            // Agrupar clusters de colisão
            const clusters = [];
            let currentCluster = [];
            
            placedEvents.forEach((ev, i) => {
                if (currentCluster.length === 0) {
                    currentCluster.push(ev);
                } else {
                    // Se este evento começa antes do último terminar, há sobreposição (simplificado)
                    // Na verdade, precisamos checar se sobrepõe com QUALQUER um do cluster atual
                    const overlaps = currentCluster.some(c => ev.startMin < c.endMin);
                    if (overlaps) {
                        currentCluster.push(ev);
                    } else {
                        clusters.push(currentCluster);
                        currentCluster = [ev];
                    }
                }
            });
            if(currentCluster.length > 0) clusters.push(currentCluster);

            // Renderizar Clusters
            clusters.forEach(cluster => {
                const width = 100 / cluster.length; // Divide largura igualmente
                cluster.forEach((ev, index) => {
                    const topPx = (ev.startMin / 60) * PIXELS_PER_HOUR;
                    const heightPx = ((ev.endMin - ev.startMin) / 60) * PIXELS_PER_HOUR;
                    const leftPerc = index * width;

                    const el = createCalendarEventElement(ev.deal, ev.schedule, topPx, heightPx, width, leftPerc);
                    columnEl.appendChild(el);
                });
            });
        }

        function createCalendarEventElement(deal, schedule, top, height, widthPct, leftPct) {
            const el = document.createElement('div');
            el.className = 'calendar-event';
            el.style.top = `${top}px`;
            el.style.height = `${height}px`;
            el.style.width = `${widthPct - 2}%`; // -2% pra margem
            el.style.left = `${leftPct + 1}%`;
            el.draggable = true;
            el.dataset.dealId = deal.ID;
            
            const instaladores = schedule.instaladores ? schedule.instaladores.split(',') : [];
            const tagsHtml = instaladores.map(i => `<span class="tag-installer">${i.trim()}</span>`).join('');
            
            const start = new Date(schedule.start_time);
            const timeStr = `${start.getHours().toString().padStart(2,'0')}:${start.getMinutes().toString().padStart(2,'0')}`;

            el.innerHTML = `
                <button class="btn-edit-event" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                <div class="event-time">${timeStr}</div>
                <div class="event-title" title="${deal[NOME_CLIENTE_FIELD]}">#${deal.TITLE || deal.ID} - ${deal[NOME_CLIENTE_FIELD] || ''}</div>
                <div class="event-tags">${tagsHtml}</div>
            `;

            // Listeners
            el.addEventListener('dragstart', handleDragStart);
            el.querySelector('.btn-edit-event').addEventListener('click', (e) => {
                e.stopPropagation();
                openScheduleModal(deal, schedule);
            });
            el.addEventListener('click', () => openDetailsModal(deal.ID)); // Clica no corpo abre detalhes

            return el;
        }

        function createBacklogCardElement(deal) {
            const el = document.createElement('div');
            el.className = 'backlog-card';
            el.draggable = true;
            el.dataset.dealId = deal.ID;
            el.innerHTML = `
                <div style="font-weight:700; color:#555">#${deal.TITLE || deal.ID}</div>
                <div style="font-size:0.85rem">${deal[NOME_CLIENTE_FIELD] || 'Cliente'}</div>
            `;
            el.addEventListener('dragstart', handleDragStart);
            return el;
        }

        function addRedNeedle(column) {
            const needle = document.createElement('div');
            needle.className = 'current-time-line';
            needle.innerHTML = '<div class="current-time-circle"></div>';
            column.appendChild(needle);
            function update() {
                const now = new Date();
                const h = now.getHours() + (now.getMinutes()/60);
                if (h >= CALENDAR_START_HOUR && h <= CALENDAR_END_HOUR) {
                    needle.style.top = `${(h - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px`;
                    needle.style.display = 'block';
                } else needle.style.display = 'none';
            }
            update();
            setInterval(update, 60000);
        }

        // --- DRAG & DROP ---
        let draggedDuration = 2; // Horas padrão
        
        function handleDragStart(e) {
            e.dataTransfer.setData('text/plain', this.dataset.dealId);
            
            // Tenta pegar duração atual se for evento existente
            const sch = getScheduleForDeal(this.dataset.dealId);
            if (sch) {
                const s = new Date(sch.start_time);
                const end = new Date(sch.end_time);
                draggedDuration = (end - s) / (1000 * 60 * 60);
            } else {
                draggedDuration = 2;
            }
        }

        function handleDragOver(e) { e.preventDefault(); this.classList.add('droppable-hover'); }
        function handleDragLeave(e) { this.classList.remove('droppable-hover'); }

        async function handleDropOnCalendar(e) {
            e.preventDefault();
            this.classList.remove('droppable-hover');
            
            const dealId = e.dataTransfer.getData('text/plain');
            if (!dealId) return;

            // Calcular hora baseada no clique
            const rect = this.getBoundingClientRect();
            const offsetY = e.clientY - rect.top + this.scrollTop;
            let hourDecimal = (offsetY / PIXELS_PER_HOUR) + CALENDAR_START_HOUR;
            hourDecimal = Math.round(hourDecimal * 2) / 2; // Snap 30min

            if (hourDecimal < CALENDAR_START_HOUR) hourDecimal = CALENDAR_START_HOUR;
            if (hourDecimal + draggedDuration > CALENDAR_END_HOUR) hourDecimal = CALENDAR_END_HOUR - draggedDuration;

            const dateIso = this.dataset.dateIso;
            const startTime = new Date(`${dateIso}T00:00:00`);
            const h = Math.floor(hourDecimal);
            const m = (hourDecimal - h) * 60;
            startTime.setHours(h, m, 0);

            const endTime = new Date(startTime);
            endTime.setMinutes(startTime.getMinutes() + (draggedDuration * 60));

            const existing = getScheduleForDeal(dealId);
            const instaladores = existing ? existing.instaladores : '';

            await saveSchedule(dealId, startTime, endTime, instaladores);
        }

        // --- MODAL DE EDIÇÃO AVANÇADA ---
        function openScheduleModal(deal, schedule) {
            currentEditingDealId = deal.ID;
            
            // Preencher Instaladores
            inputInstaladores.value = schedule.instaladores || '';
            
            // Preencher Data e Hora
            const start = new Date(schedule.start_time);
            const end = new Date(schedule.end_time);
            
            // Input Date aceita YYYY-MM-DD
            inputDiaInicio.value = start.toISOString().split('T')[0];
            
            // Input Time aceita HH:MM
            const hh = start.getHours().toString().padStart(2, '0');
            const mm = start.getMinutes().toString().padStart(2, '0');
            inputHoraInicio.value = `${hh}:${mm}`;

            // Duração
            const dur = (end - start) / (1000 * 60 * 60);
            inputDuracao.value = dur.toFixed(1);

            modalAgendamento.classList.add('active');
        }

        btnSalvarAgendamento.addEventListener('click', async () => {
            if (!currentEditingDealId) return;

            // Ler inputs
            const dia = inputDiaInicio.value; // YYYY-MM-DD
            const hora = inputHoraInicio.value; // HH:MM
            const duracao = parseFloat(inputDuracao.value);
            const instaladores = inputInstaladores.value;

            if (!dia || !hora || !duracao) {
                alert("Preencha data, hora e duração.");
                return;
            }

            // Construir Datas
            const start = new Date(`${dia}T${hora}:00`);
            const end = new Date(start);
            end.setMinutes(start.getMinutes() + (duracao * 60));

            await saveSchedule(currentEditingDealId, start, end, instaladores);
            modalAgendamento.classList.remove('active');
        });

        // Backend Save
        async function saveSchedule(dealId, start, end, instaladores) {
            showToast('Salvando...', 'success');
            try {
                const res = await fetch('/api/instalacao/saveSchedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dealId, 
                        startTime: start.toISOString(), 
                        endTime: end.toISOString(), 
                        instaladores
                    })
                });

                if (res.ok) {
                    // Update Local Array
                    const idx = allSchedules.findIndex(s => s.bitrix_deal_id == dealId);
                    const newObj = { bitrix_deal_id: dealId, start_time: start.toISOString(), end_time: end.toISOString(), instaladores };
                    
                    if (idx >= 0) allSchedules[idx] = newObj;
                    else allSchedules.push(newObj);

                    renderCalendar(); // Re-renderiza para aplicar overlaps
                    showToast('Agendamento atualizado!', 'success');
                } else {
                    showToast('Erro ao salvar no banco.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Erro de conexão.', 'error');
            }
        }

        // --- MODAL DETALHES (Visualizar) ---
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            modalTitle.textContent = `Instalação #${deal.TITLE || deal.ID}`;
            
            const rawLink = deal[LAYOUT_FIELD];
            let img = rawLink ? `<img src="${rawLink}" class="layout-img">` : '<div style="text-align:center; padding:20px; color:#aaa"><i class="fas fa-image fa-3x"></i><br>Sem Layout</div>';
            
            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">${img}</div>
                    <div class="detalhe-col-lateral">
                        <h3>${deal[NOME_CLIENTE_FIELD] || 'Cliente'}</h3>
                        <p><strong>Contato:</strong> ${deal[CONTATO_CLIENTE_FIELD] || '-'}</p>
                        <hr>
                        <button id="btn-concluir-inst" class="btn-concluir"><i class="fas fa-check"></i> Instalação Realizada</button>
                    </div>
                </div>`;
            
            modal.classList.add('active');
            
            const btnConc = document.getElementById('btn-concluir-inst');
            if(btnConc) {
                btnConc.addEventListener('click', async () => {
                    if(confirm("Confirmar conclusão? O card sairá da lista.")) {
                        try {
                            const r = await fetch('/api/instalacao/concluir', {
                                method: 'POST',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({ sessionToken, dealId })
                            });
                            if(r.ok) { 
                                modal.classList.remove('active');
                                showToast("Concluído!", "success");
                                // Remove visualmente
                                allDealsData = allDealsData.filter(d => d.ID != dealId);
                                renderKanban(); renderCalendar();
                            }
                        } catch(e) { console.error(e); }
                    }
                });
            }
        }

        // --- GLOBAL LISTENERS ---
        btnViewKanban.addEventListener('click', () => {
            boardKanban.classList.remove('hidden'); boardCalendar.classList.add('hidden');
            btnViewKanban.classList.add('active'); btnViewCalendar.classList.remove('active');
        });
        btnViewCalendar.addEventListener('click', () => {
            boardKanban.classList.add('hidden'); boardCalendar.classList.remove('hidden');
            btnViewKanban.classList.remove('active'); btnViewCalendar.classList.add('active');
            renderCalendar();
        });

        // Fechar modais
        document.querySelectorAll('.close-modal').forEach(b => {
            b.addEventListener('click', function() {
                this.closest('.modal-overlay').classList.remove('active');
            });
        });

        // Init
        loadAllData();
    });
})();
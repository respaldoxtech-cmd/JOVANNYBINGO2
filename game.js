/**
 * 🎮 LÓGICA DEL CLIENTE DE JUEGO
 */

const socket = io();
let currentUser = null;
let myCards = [];

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión
    const session = localStorage.getItem('yovanny_user');
    if (!session) {
        window.location.href = '/index.html';
        return;
    }

    currentUser = JSON.parse(session);
    initUI();
    connectToGame();
});

function initUI() {
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('user-avatar').textContent = currentUser.username.charAt(0).toUpperCase();
    
    // Manejo del Chat
    document.getElementById('chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (text) {
            socket.emit('send_chat', text);
            input.value = '';
        }
    });
}

function connectToGame() {
    // Verificar si ya tiene juego activo
    fetch(`/api/active-game/${currentUser.username}`)
        .then(r => r.json())
        .then(data => {
            if (data.hasGame) {
                console.log('🔄 Reconectando a partida existente...');
                socket.emit('reconnect_player', { 
                    username: currentUser.username, 
                    cardIds: data.cardIds 
                });
            } else {
                // Si no tiene juego, solicitar unirse (por defecto 1 cartón aleatorio para demo)
                // En un flujo real, aquí mostrarías un modal para elegir cartones
                const randomId = Math.floor(Math.random() * 300) + 1;
                console.log('🆕 Uniéndose con cartón nuevo:', randomId);
                socket.emit('join_game', { 
                    username: currentUser.username, 
                    cardIds: [randomId] 
                });
            }
        });
}

// --- EVENTOS DE SOCKET ---

socket.on('connect', () => {
    document.getElementById('connection-status').textContent = '🟢 Conectado';
    document.getElementById('connection-status').style.color = 'var(--success)';
});

socket.on('disconnect', () => {
    document.getElementById('connection-status').textContent = '🔴 Desconectado';
    document.getElementById('connection-status').style.color = 'var(--danger)';
});

socket.on('init_cards', (data) => {
    myCards = data.cards;
    renderCards(myCards);
    
    // Inicializar Asistente Inteligente
    if (window.GameAssistant) {
        window.GameAssistant.init(socket, myCards);
    }
});

socket.on('reconnection_success', (data) => {
    myCards = data.cards;
    renderCards(myCards);
    if (window.GameAssistant) window.GameAssistant.init(socket, myCards);
});

socket.on('sync_state', (state) => {
    // Actualizar bola actual
    const lastNum = state.calledNumbers.length > 0 ? state.calledNumbers[state.calledNumbers.length - 1] : '--';
    updateCurrentBall(lastNum);
    
    // Actualizar historial
    updateHistory(state.last5Numbers);
    
    // Actualizar patrón
    document.getElementById('pattern-name').textContent = state.pattern.toUpperCase();
    
    // Marcar cartones
    state.calledNumbers.forEach(num => markNumberInCards(num));
    
    // Actualizar asistente
    if (window.GameAssistant) {
        window.GameAssistant.update(state.calledNumbers, state.pattern, state.customPattern);
    }
});

socket.on('number_called', (data) => {
    updateCurrentBall(data.num);
    updateHistory(data.last5);
    markNumberInCards(data.num);
    
    // Efecto de sonido (simple)
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3'); 
    audio.play().catch(e => {}); // Ignorar error de autoplay
    
    if (window.GameAssistant) {
        // El asistente se actualiza automáticamente al recibir el estado, 
        // pero podemos forzar chequeo aquí si tenemos el estado local completo
    }
});

socket.on('chat_message', (data) => {
    addChatMessage(data);
});

socket.on('winner_announced', (data) => {
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });
    alert(`🏆 ¡BINGO! Ganador: ${data.user} (Cartón #${data.card})`);
});

// --- FUNCIONES DE UI ---

function renderCards(cards) {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';
    
    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'bingo-card';
        cardEl.id = `card-${card.id}`; // ID para el asistente
        
        let gridHtml = '<div class="card-grid-inner">';
        
        // Cabeceras B I N G O
        ['B', 'I', 'N', 'G', 'O'].forEach(l => {
            gridHtml += `<div class="grid-cell header">${l}</div>`;
        });
        
        // Celdas (Transponer matriz para renderizar por filas)
        for (let r = 0; r < 5; r++) {
            const rowVals = [card.B[r], card.I[r], card.N[r], card.G[r], card.O[r]];
            rowVals.forEach(val => {
                const isFree = val === "FREE";
                const displayVal = isFree ? '★' : val;
                const cellClass = isFree ? 'grid-cell free marked' : 'grid-cell';
                const idAttr = isFree ? '' : `id="cell-${card.id}-${val}"`;
                
                gridHtml += `<div class="${cellClass}" ${idAttr}>${displayVal}</div>`;
            });
        }
        gridHtml += '</div>';
        
        cardEl.innerHTML = `
            <div class="card-header">
                <span>Cartón #${card.id}</span>
                <i class="fa-solid fa-expand"></i>
            </div>
            ${gridHtml}
        `;
        
        container.appendChild(cardEl);
    });
}

function updateCurrentBall(num) {
    const ball = document.getElementById('current-ball');
    // Animación de cambio
    ball.style.transform = 'scale(0.8)';
    setTimeout(() => {
        ball.textContent = num;
        ball.style.transform = 'scale(1)';
    }, 150);
}

function updateHistory(numbers) {
    const container = document.getElementById('history-container');
    container.innerHTML = numbers.map((n, i) => 
        `<div class="mini-ball ${i === 0 ? 'active' : ''}">${n}</div>`
    ).join('');
}

function markNumberInCards(num) {
    // Buscar en todos los cartones renderizados
    myCards.forEach(card => {
        const cell = document.getElementById(`cell-${card.id}-${num}`);
        if (cell) {
            cell.classList.add('marked');
        }
    });
}

function addChatMessage(data) {
    const container = document.getElementById('chat-messages');
    const isMine = data.user === currentUser.username;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isMine ? 'mine' : ''}`;
    msgDiv.innerHTML = `<strong>${data.user}</strong> ${data.text}`;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function logout() {
    localStorage.removeItem('yovanny_user');
    window.location.href = '/index.html';
}

window.shoutBingo = function() {
    socket.emit('bingo_shout');
};
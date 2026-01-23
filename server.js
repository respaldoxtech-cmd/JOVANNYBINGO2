const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

const ADMIN_PASS = "admin123";

app.post('/admin-login', (req, res) => {
    res.json({ success: req.body.password === ADMIN_PASS });
});

let gameState = {
    calledNumbers: [],
    pattern: 'line', // 'line' (Normal), 'full' (Lleno), 'corners', 'custom'
    customPattern: [],
    last5Numbers: [],
    last5Winners: [],
    message: "¡BIENVENIDOS AL BINGO YOVANNY!"
};

// Registro de cartones en uso (Para evitar duplicados)
let takenCards = new Set();

function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function generateCard(cardId) {
    const rng = mulberry32(cardId);
    const fillCol = (min, max, count) => {
        let nums = new Set();
        let safety = 0;
        while(nums.size < count && safety < 500) {
            let n = Math.floor(rng() * (max - min + 1)) + min;
            nums.add(n);
            safety++;
        }
        return Array.from(nums);
    };

    const colN = fillCol(31, 45, 4);
    const N = [colN[0], colN[1], "FREE", colN[2], colN[3]];

    return {
        id: cardId,
        B: fillCol(1, 15, 5),
        I: fillCol(16, 30, 5),
        N: N,
        G: fillCol(46, 60, 5),
        O: fillCol(61, 75, 5)
    };
}

// --- LÓGICA DE VICTORIA CORREGIDA ---
function checkWin(card, called, patternType, customGrid) {
    // Aplanamos el cartón por columnas: indices 0-4(B), 5-9(I), 10-14(N), etc.
    // Indice 12 es el centro (FREE)
    let flatCard = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O];

    // Función auxiliar para ver si una celda está marcada
    const isMarked = (val) => val === "FREE" || called.includes(val);

    // MODO NORMAL (Cualquier Línea: Horizontal, Vertical o Diagonal)
    if (patternType === 'line') {
        const winningLines = [
            // Columnas (B, I, N, G, O)
            [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
            // Filas
            [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
            // Diagonales
            [0,6,12,18,24], [4,8,12,16,20]
        ];
        // Si CUALQUIERA de estas combinaciones está completa
        return winningLines.some(line => line.every(idx => isMarked(flatCard[idx])));
    }

    // MODO CARTÓN LLENO (Full House)
    if (patternType === 'full') {
        return flatCard.every(val => isMarked(val));
    }

    // MODO 4 ESQUINAS
    if (patternType === 'corners') {
        const corners = [0, 4, 20, 24];
        return corners.every(idx => isMarked(flatCard[idx]));
    }

    // MODO PERSONALIZADO (Figura manual)
    if (patternType === 'custom') {
        // En customGrid los índices van por filas visuales (0-4 fila 1, etc)
        // flatCard va por columnas. Debemos mapear o usar una lógica consistente.
        // Asumiendo que el admin dibuja visualmente en grid 5x5:
        // Admin Grid: Fila 1 = índices 0,1,2,3,4.
        // FlatCard:   Fila 1 = índices 0,5,10,15,20.

        for(let r=0; r<5; r++) {
            for(let c=0; c<5; c++) {
                const adminIdx = r * 5 + c; // Indice lineal del admin (filas)
                const cardIdx = c * 5 + r;  // Indice lineal del cartón (columnas)

                if(customGrid[adminIdx] && !isMarked(flatCard[cardIdx])) {
                    return false;
                }
            }
        }
        return true;
    }

    return false;
}

io.on('connection', (socket) => {
    socket.emit('sync_state', gameState);

    socket.on('join_game', (data) => {
        let ids = [];
        // Normalizar entrada (puede ser string "1, 2" o numero 1)
        if (Array.isArray(data.cardIds)) ids = data.cardIds;
        else if (typeof data.cardIds === 'string') {
            ids = data.cardIds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        } else if (typeof data.cardIds === 'number') {
            ids = [data.cardIds];
        }

        if(ids.length === 0) return;

        // --- VALIDACIÓN DE DUPLICADOS ---
        const duplicates = ids.filter(id => takenCards.has(id));

        if (duplicates.length > 0) {
            // Rechazar conexión si algún cartón está ocupado
            socket.emit('join_error', {
                message: `El cartón #${duplicates.join(', #')} ya está en uso por otro jugador.`
            });
            return;
        }

        // Si pasa la validación, registrar los cartones
        ids.forEach(id => takenCards.add(id));
        socket.data = { username: data.username, cardIds: ids };

        const cards = ids.map(id => generateCard(id));
        socket.emit('init_cards', { cards });
        io.emit('update_players', getActivePlayers());
    });

    socket.on('admin_call_number', (num) => {
        if (!gameState.calledNumbers.includes(num)) {
            gameState.calledNumbers.push(num);
            gameState.last5Numbers.unshift(num);
            if (gameState.last5Numbers.length > 5) gameState.last5Numbers.pop();
            io.emit('number_called', { num, last5: gameState.last5Numbers });
        }
    });

    socket.on('admin_set_pattern', (data) => {
        gameState.pattern = data.type;
        gameState.customPattern = data.grid || [];
        io.emit('pattern_changed', gameState.pattern);
    });

    socket.on('admin_set_message', (msg) => {
        gameState.message = msg;
        io.emit('message_updated', msg);
    });

    socket.on('admin_kick_player', (socketId) => {
        const target = io.sockets.sockets.get(socketId);
        if (target) {
            // Al expulsar, liberar cartones manualmente antes de desconectar
            if (target.data.cardIds) {
                target.data.cardIds.forEach(id => takenCards.delete(id));
            }
            target.emit('kicked');
            target.disconnect();
            io.emit('update_players', getActivePlayers());
        }
    });

    socket.on('admin_reset', () => {
        gameState.calledNumbers = [];
        gameState.last5Numbers = [];
        io.emit('game_reset');
    });

    socket.on('bingo_shout', () => {
        const { username, cardIds } = socket.data;
        if(!cardIds || cardIds.length === 0) return;

        let winnerCardId = null;
        for (let id of cardIds) {
            const card = generateCard(id);
            if (checkWin(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern)) {
                winnerCardId = id;
                break;
            }
        }

        if (winnerCardId) {
            const winData = { user: username, card: winnerCardId, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
            const isDup = gameState.last5Winners.some(w => w.user === username && w.card === winnerCardId);
            if (!isDup) {
                gameState.last5Winners.unshift(winData);
                if(gameState.last5Winners.length > 5) gameState.last5Winners.pop();
            }
            io.emit('winner_announced', winData);
            io.emit('update_history', gameState.last5Winners);
        } else {
            socket.emit('invalid_bingo');
        }
    });

    // --- AL DESCONECTARSE, LIBERAR CARTONES ---
    socket.on('disconnect', () => {
        if (socket.data.cardIds) {
            socket.data.cardIds.forEach(id => takenCards.delete(id));
        }
        io.emit('update_players', getActivePlayers());
    });
});

function getActivePlayers() {
    return Array.from(io.sockets.sockets.values())
        .filter(s => s.data.username)
        .map(s => ({
            id: s.id,
            name: s.data.username,
            cardCount: s.data.cardIds ? s.data.cardIds.length : 0
        }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Yovanny Bingo V12 (Unique Cards) en puerto ${PORT}`));

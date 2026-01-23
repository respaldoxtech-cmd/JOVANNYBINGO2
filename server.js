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

// Sistema de moderación de jugadores
let pendingPlayers = new Map(); // socketId -> {username, cardIds, socket}
let virtualPlayers = new Map(); // virtualId -> {username, cardIds} - Jugadores agregados manualmente

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
    console.log(`🔍 Verificando victoria - Patrón: ${patternType}, Números llamados: ${called.length}`);

    // Aplanamos el cartón por columnas: indices 0-4(B), 5-9(I), 10-14(N), etc.
    // Indice 12 es el centro (FREE)
    let flatCard = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O];

    // Función auxiliar para ver si una celda está marcada
    const isMarked = (val) => val === "FREE" || called.includes(val);

    // Define winning patterns as arrays of indices
    const patterns = {
        'line': [
            // Columnas (B, I, N, G, O)
            [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
            // Filas
            [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
            // Diagonales
            [0,6,12,18,24], [4,8,12,16,20]
        ],
        'full': [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]], // All positions
        'corners': [[0,4,20,24]], // 4 corners
        'x': [[0,6,12,18,24], [4,8,12,16,20]], // Both diagonals (either one wins)
        'plus': [[7,11,12,13,17]], // Plus shape: center + 4 arms
        'corners_center': [[0,4,12,20,24]], // Corners plus center
        'frame': [[0,1,2,3,4,9,14,19,24,23,22,21,20,15,10,5]], // Outer frame
        'inner_frame': [[6,7,8,11,13,16,17,18]], // Inner square (3x3 center)
        'letter_h': [[0,5,10,15,20,2,7,12,17,22,4,9,14,19,24]], // H shape (all positions)
        'letter_t': [[0,1,2,3,4,7,12,17]], // T shape (top row + center column)
        'small_square': [[0,1,5,6]], // Top-left 2x2 square
        'diamond': [[2,6,10,14,18,22]], // Diamond shape (hourglass)
        'star': [[2,6,8,10,12,14,16,18,7,11,12,13,17]], // Star shape (corners + plus)
        'heart': [[1,3,6,7,8,9,11,12,13,16,18]], // Heart shape
        'airplane': [[1,3,5,7,9,11,13,15,17,19,21,23]], // Airplane shape
        'arrow': [[2,7,10,11,12,13,14,17]], // Arrow pointing down
        'crazy': [[0,2,4,6,8,10,12,14,16,18,20,22,24]], // Crazy zigzag pattern
        'pyramid': [[2,6,7,8,10,11,12,13,14,16,17,18]], // Pyramid shape
        'cross': [[2,7,11,12,13,17,22]], // Cross shape
        'custom': null // Handled separately
    };

        // MODO LÍNEA HORIZONTAL
        if (patternType === 'line_horizontal') {
            const horizontalLines = [
                [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24]
            ];
            return horizontalLines.some(line => line.every(idx => isMarked(flatCard[idx])));
        }

        // MODO LÍNEA VERTICAL
        if (patternType === 'line_vertical') {
            const verticalLines = [
                [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24]
            ];
            return verticalLines.some(line => line.every(idx => isMarked(flatCard[idx])));
        }

        // MODO LÍNEA DIAGONAL
        if (patternType === 'line_diagonal') {
            const diagonalLines = [
                [0,6,12,18,24], [4,8,12,16,20]
            ];
            return diagonalLines.some(line => line.every(idx => isMarked(flatCard[idx])));
        }

        // MODO LÍNEA (NORMAL) - Cualquier línea
        if (patternType === 'line') {
            const winningLines = [
                // Columnas (B, I, N, G, O)
                [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
                // Filas
                [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
                // Diagonales
                [0,6,12,18,24], [4,8,12,16,20]
            ];
            return winningLines.some(line => line.every(idx => isMarked(flatCard[idx])));
        }

    // MODO CARTÓN LLENO (Full House)
    if (patternType === 'full') {
        return patterns.full[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO 4 ESQUINAS
    if (patternType === 'corners') {
        return patterns.corners[0].every(idx => isMarked(flatCard[idx]));
    }

    // Modos con patrones específicos - check if ANY of the pattern lines is complete
    if (patterns[patternType]) {
        const result = patterns[patternType].some(line => line.every(idx => isMarked(flatCard[idx])));
        console.log(`🎯 Patrón ${patternType} resultado: ${result}`);
        if (result) {
            console.log(`✅ Patrón ${patternType} COMPLETADO!`);
        }
        return result;
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
    // Si es admin, enviar listas de jugadores
    socket.emit('update_pending_players', getPendingPlayers());
    socket.emit('update_players', getActivePlayers());

    socket.on('join_game', (data) => {
        let ids = [];
        // Normalizar entrada (puede ser string "1, 2" o numero 1)
        if (Array.isArray(data.cardIds)) ids = data.cardIds;
        else if (typeof data.cardIds === 'string') {
            ids = data.cardIds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        } else if (typeof data.cardIds === 'number') {
            ids = [data.cardIds];
        }

        // Validar que los IDs estén en el rango válido (1-300)
        ids = ids.filter(id => id >= 1 && id <= 300);

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

        // Permitir cualquier cantidad de cartones (sin límite)
        // Poner al jugador en lista de pendientes para aprobación
        pendingPlayers.set(socket.id, {
            username: data.username,
            cardIds: ids,
            socket: socket,
            timestamp: Date.now()
        });

        // Notificar al admin sobre el nuevo jugador pendiente
        io.emit('update_pending_players', getPendingPlayers());
        io.emit('new_player_pending', {
            id: socket.id,
            name: data.username,
            cardCount: ids.length
        });

        // Informar al jugador que está esperando aprobación
        socket.emit('waiting_approval', {
            message: `Esperando aprobación del administrador... (${ids.length} cartones solicitados)`
        });
    });

    socket.on('admin_call_number', (num) => {
        if (!gameState.calledNumbers.includes(num)) {
            gameState.calledNumbers.push(num);
            gameState.last5Numbers.unshift(num);
            if (gameState.last5Numbers.length > 5) gameState.last5Numbers.pop();

            console.log(`🎯 Número llamado: ${num}`);
            console.log(`📊 Patrón actual: ${gameState.pattern}`);
            console.log(`🔢 Números llamados hasta ahora: ${gameState.calledNumbers.length}`);

            // Emitir el número llamado
            io.emit('number_called', { num, last5: gameState.last5Numbers });

            // Verificar automáticamente si algún jugador ha ganado
            setTimeout(() => {
                checkForAutomaticWinners();
            }, 100); // Pequeño delay para asegurar que todos los clientes procesen el número
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

    socket.on('admin_accept_player', (socketId) => {
        const pendingPlayer = pendingPlayers.get(socketId);
        if (pendingPlayer) {
            // Verificar duplicados antes de aceptar
            const duplicates = pendingPlayer.cardIds.filter(id => takenCards.has(id));
            if (duplicates.length > 0) {
                pendingPlayer.socket.emit('join_error', {
                    message: `Los cartones #${duplicates.join(', #')} ya están en uso.`
                });
                pendingPlayers.delete(socketId);
                io.emit('update_pending_players', getPendingPlayers());
                return;
            }

            // Aceptar al jugador: registrar cartones y inicializar
            pendingPlayer.cardIds.forEach(id => takenCards.add(id));
            pendingPlayer.socket.data = {
                username: pendingPlayer.username,
                cardIds: pendingPlayer.cardIds
            };

            // Generar y enviar cartones
            const cards = pendingPlayer.cardIds.map(id => generateCard(id));
            pendingPlayer.socket.emit('init_cards', { cards });

            // Remover de pendientes y actualizar listas
            pendingPlayers.delete(socketId);
            io.emit('update_pending_players', getPendingPlayers());
            io.emit('update_players', getActivePlayers());

            // Notificar aceptación
            pendingPlayer.socket.emit('player_accepted');
        }
    });

    socket.on('admin_reject_player', (socketId) => {
        const pendingPlayer = pendingPlayers.get(socketId);
        if (pendingPlayer) {
            // Rechazar al jugador
            pendingPlayer.socket.emit('player_rejected', {
                message: 'Tu solicitud ha sido rechazada por el administrador.'
            });
            pendingPlayers.delete(socketId);
            io.emit('update_pending_players', getPendingPlayers());
        }
    });

    socket.on('admin_add_player', (data) => {
        const { name, cardIds } = data;

        // Validate card IDs
        const validCardIds = cardIds.filter(id => id >= 1 && id <= 300);

        if (validCardIds.length === 0) {
            socket.emit('admin_error', { message: 'No hay cartones válidos para asignar.' });
            return;
        }

        // Check for duplicates
        const duplicates = validCardIds.filter(id => takenCards.has(id));
        if (duplicates.length > 0) {
            socket.emit('admin_error', {
                message: `Los cartones #${duplicates.join(', #')} ya están en uso.`
            });
            return;
        }

        // Create a virtual socket for this player (they won't be connected)
        const virtualSocket = {
            id: `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            data: {}
        };

        // Set up the player data
        virtualSocket.data = {
            username: name,
            cardIds: validCardIds
        };

        // Mark cards as taken
        validCardIds.forEach(id => takenCards.add(id));

        // Create and store virtual player
        const virtualId = `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        virtualPlayers.set(virtualId, {
            username: name,
            cardIds: validCardIds,
            addedAt: Date.now()
        });

        console.log(`Jugador agregado manualmente: ${name} con cartones ${validCardIds.join(', ')}`);

        // Update admin interface
        io.emit('update_players', getActivePlayers());
        io.emit('update_pending_players', getPendingPlayers());

        // Notify admin of success
        socket.emit('admin_success', {
            message: `Jugador "${name}" agregado exitosamente con ${validCardIds.length} cartones.`
        });
    });

    // Get card availability for admin modal and status
    socket.on('get_card_availability', () => {
        const takenCardsArray = Array.from(takenCards);
        socket.emit('card_availability', {
            takenCards: takenCardsArray,
            availableCount: 300 - takenCards.size,
            usedCount: takenCards.size
        });
    });

    socket.on('admin_reset', () => {
        // Reset game state for new round
        gameState.calledNumbers = [];
        gameState.last5Numbers = [];
        gameState.last5Winners = [];

        // Keep players connected but reset their game state
        io.sockets.sockets.forEach(s => {
            if (s.data.cardIds) {
                // This is a player, keep them connected but reset their game
                s.emit('game_reset');
            }
        });

        // Clear taken cards (players will need to request new cards)
        takenCards.clear();

        // Keep pending players list as is

        // Emit game reset to admin interface
        io.emit('update_pending_players', getPendingPlayers());
        io.emit('update_players', getActivePlayers());
    });

    socket.on('admin_full_reset', () => {
        // Full reset - disconnect all players and reset everything
        gameState.calledNumbers = [];
        gameState.last5Numbers = [];
        gameState.last5Winners = [];

        // Disconnect all active players and clear their sessions
        io.sockets.sockets.forEach(s => {
            if (s.data.cardIds) {
                // This is a player, disconnect them and clear session
                s.emit('full_reset'); // Tell client to clear localStorage
                s.emit('kicked');
                s.disconnect();
            }
        });

        // Clear taken cards
        takenCards.clear();

        // Clear pending players
        pendingPlayers.clear();

        // Clear virtual players (manually added players)
        virtualPlayers.clear();

        // Emit game reset (though players are disconnected, admin will receive it)
        io.emit('game_reset');
        io.emit('update_pending_players', getPendingPlayers());
        io.emit('update_players', getActivePlayers());
    });

    // Handle player reconnection
    socket.on('reconnect_player', (data) => {
        const { username, cardIds, sessionId } = data;

        // Verify that the cards are still assigned to this player
        const isValidReconnection = cardIds.every(id => takenCards.has(id));

        if (isValidReconnection) {
            // Successful reconnection
            socket.data = {
                username: username,
                cardIds: cardIds
            };

            // Generate and send cards
            const cards = cardIds.map(id => generateCard(id));
            socket.emit('reconnection_success', { cards });

            // Update admin interface
            io.emit('update_players', getActivePlayers());

            console.log(`Jugador ${username} reconectado exitosamente con ${cardIds.length} cartones`);
        } else {
            // Failed reconnection - cards no longer available
            socket.emit('reconnection_failed', {
                message: 'Tus cartones ya no están disponibles. Por favor solicita nuevos.'
            });
            console.log(`Reconexión fallida para ${username} - cartones no disponibles`);
        }
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
            // Anuncio automático inmediato
            io.emit('winner_announced', winData);
            io.emit('update_history', gameState.last5Winners);

            // También emitimos un evento especial para celebración automática
            io.emit('bingo_celebration', {
                message: `¡BINGO! ${username} ha ganado con el cartón #${winnerCardId}!`,
                winner: winData
            });
        } else {
            socket.emit('invalid_bingo');
        }
    });

    // --- AL DESCONECTARSE ---
    socket.on('disconnect', () => {
        // NO liberar cartones - los jugadores permanecen activos incluso si cierran la ventana
        // Solo se liberan cartones al hacer "REINICIAR TODO"

        // Limpiar de jugadores pendientes (solo si estaban esperando aprobación)
        if (pendingPlayers.has(socket.id)) {
            pendingPlayers.delete(socket.id);
            io.emit('update_pending_players', getPendingPlayers());
        }

        // Los jugadores activos permanecen en la lista incluso desconectados
        // Solo se actualiza la lista visual, pero mantienen sus cartones asignados
        io.emit('update_players', getActivePlayers());
    });
});

function getActivePlayers() {
    // Get connected players
    const connectedPlayers = Array.from(io.sockets.sockets.values())
        .filter(s => s.data.username)
        .map(s => ({
            id: s.id,
            name: s.data.username,
            cardCount: s.data.cardIds ? s.data.cardIds.length : 0,
            status: 'connected'
        }));

    // Get virtual players (manually added)
    const virtualPlayersList = Array.from(virtualPlayers.entries())
        .map(([virtualId, player]) => ({
            id: virtualId,
            name: player.username,
            cardCount: player.cardIds.length,
            status: 'virtual'
        }));

    // Combine both lists
    return [...connectedPlayers, ...virtualPlayersList];
}

function getPendingPlayers() {
    return Array.from(pendingPlayers.entries()).map(([socketId, player]) => ({
        id: socketId,
        name: player.username,
        cardCount: player.cardIds.length,
        cardIds: player.cardIds,
        timestamp: player.timestamp
    }));
}

// Función para verificar automáticamente ganadores después de cada número
function checkForAutomaticWinners() {
    // Obtener todos los jugadores activos (conectados + virtuales)
    const connectedPlayers = Array.from(io.sockets.sockets.values())
        .filter(s => s.data.username && s.data.cardIds && s.data.cardIds.length > 0)
        .map(s => ({
            username: s.data.username,
            cardIds: s.data.cardIds,
            type: 'connected'
        }));

    // Agregar jugadores virtuales (agregados manualmente)
    const virtualPlayersList = Array.from(virtualPlayers.values())
        .map(player => ({
            username: player.username,
            cardIds: player.cardIds,
            type: 'virtual'
        }));

    // Combinar todas las listas de jugadores
    const allActivePlayers = [...connectedPlayers, ...virtualPlayersList];

    // Verificar cada jugador activo
    for (const player of allActivePlayers) {
        const { username, cardIds } = player;

        // Verificar si este jugador ya ganó en esta partida (para evitar duplicados)
        const alreadyWon = gameState.last5Winners.some(w => w.user === username);
        if (alreadyWon) continue;

        // Verificar cada cartón del jugador
        for (let cardId of cardIds) {
            const card = generateCard(cardId);

            // Verificar si este cartón gana con el patrón actual
            if (checkWin(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern)) {
                // ¡HAY UN GANADOR! Anunciar automáticamente
                const winData = {
                    user: username,
                    card: cardId,
                    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                };

                // Evitar duplicados (aunque ya verificamos por usuario)
                const isDuplicate = gameState.last5Winners.some(w => w.user === username && w.card === cardId);
                if (!isDuplicate) {
                    gameState.last5Winners.unshift(winData);
                    if(gameState.last5Winners.length > 5) gameState.last5Winners.pop();

                    // Anuncio automático inmediato
                    io.emit('winner_announced', winData);
                    io.emit('update_history', gameState.last5Winners);

                    // Celebración automática
                    io.emit('bingo_celebration', {
                        message: `¡BINGO AUTOMÁTICO! ${username} ha ganó con el cartón #${cardId}!`,
                        winner: winData
                    });

                    console.log(`🏆 GANADOR AUTOMÁTICO: ${username} con cartón #${cardId} (${gameState.pattern})`);
                }
                break; // Solo anunciar el primer cartón ganador de este jugador
            }
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Yovanny Bingo V12 (Unique Cards) en puerto ${PORT}`));

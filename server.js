const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

const ADMIN_PASS = "admin123";

// MongoDB Connection with Atlas support and proper error handling
const connectDB = async () => {
    try {
        // Ensure MONGO_URI environment variable is set for production
        if (!process.env.MONGO_URI) {
            console.error('❌ Error: MONGO_URI environment variable is not set');
            console.error('Please set MONGO_URI in your environment variables or .env file');
            process.exit(1);
        }

        console.log('🔗 Intentando conectar a MongoDB Atlas...');
        console.log(`📍 URI: ${process.env.MONGO_URI.replace(/\/\/[^@]+@/, '//***:***@')}`); // Hide credentials in logs

        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000, // 30 seconds timeout
            socketTimeoutMS: 45000, // 45 seconds timeout
        });

        console.log(`✅ Conexión exitosa a MongoDB Atlas: ${conn.connection.host}`);
        console.log(`📊 Base de datos: ${conn.connection.name}`);
        console.log(`🔗 Estado: Conectado`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ Error de conexión a MongoDB:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  Conexión a MongoDB perdida. Intentando reconectar...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ Conexión a MongoDB restaurada');
        });

        // Graceful shutdown handling
        process.on('SIGINT', async () => {
            console.log('\n🛑 Cerrando servidor...');
            await mongoose.connection.close();
            console.log('🔌 Conexión a MongoDB cerrada');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error de conexión a MongoDB Atlas:', error.message);
        console.error('💡 Verifica que tu MONGO_URI sea correcta y que tu IP esté permitida en MongoDB Atlas');
        process.exit(1);
    }
};

// Initialize database connection
connectDB();

// Mongoose Schema for Players
const playerSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    cardIds: [{
        type: Number,
        min: 1,
        max: 300
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Index for faster queries
playerSchema.index({ username: 1 });
playerSchema.index({ cardIds: 1 });

const Player = mongoose.model('Player', playerSchema);

// Optimized functions to use database instead of in-memory arrays
async function getActivePlayersFromDB() {
    try {
        const players = await Player.find({ isActive: true }).lean();
        return players;
    } catch (error) {
        console.error('❌ Error getting active players from database:', error);
        return [];
    }
}

async function getPendingPlayersFromDB() {
    return Array.from(pendingPlayers.entries()).map(([socketId, player]) => ({
        id: socketId,
        name: player.username,
        cardCount: player.cardIds.length,
        cardIds: player.cardIds,
        timestamp: player.timestamp
    }));
}

async function addPlayerToDB(username, cardIds) {
    try {
        const player = new Player({
            username: username,
            cardIds: cardIds
        });
        await player.save();
        console.log(`✅ Jugador agregado a MongoDB: ${username} con cartones ${cardIds.join(', ')}`);
        return player;
    } catch (error) {
        console.error('❌ Error agregando jugador a MongoDB:', error);
        throw error;
    }
}

async function removePlayerFromDB(playerId) {
    try {
        await Player.findByIdAndUpdate(playerId, { isActive: false });
        console.log(`✅ Jugador eliminado de MongoDB: ${playerId}`);
    } catch (error) {
        console.error('❌ Error eliminando jugador de MongoDB:', error);
    }
}

async function getTakenCardsFromDB() {
    try {
        const players = await Player.find({ isActive: true }).lean();
        const takenCards = new Set();
        players.forEach(player => {
            player.cardIds.forEach(cardId => takenCards.add(cardId));
        });
        return takenCards;
    } catch (error) {
        console.error('❌ Error obteniendo cartones ocupados de MongoDB:', error);
        return new Set();
    }
}

// Function to sync memory with database
async function syncTakenCardsWithDB() {
    try {
        console.log('🔄 Sincronizando cartones ocupados con base de datos...');
        const takenCardsFromDB = await getTakenCardsFromDB();
        takenCards = takenCardsFromDB;
        console.log(`✅ Cartones sincronizados: ${takenCards.size} cartones ocupados`);
    } catch (error) {
        console.error('❌ Error sincronizando cartones con base de datos:', error);
    }
}

// Function to refresh player lists from database
async function refreshPlayerLists() {
    try {
        // Sync memory with database
        await syncTakenCardsWithDB();
        
        // Refresh virtual players from database
        const dbPlayers = await getActivePlayersFromDB();
        virtualPlayers.clear();
        dbPlayers.forEach(player => {
            const virtualId = `db_${player._id.toString()}`;
            virtualPlayers.set(virtualId, {
                username: player.username,
                cardIds: player.cardIds
            });
        });
        
        console.log(`✅ Listas de jugadores actualizadas: ${dbPlayers.length} jugadores de base de datos`);
    } catch (error) {
        console.error('❌ Error actualizando listas de jugadores:', error);
    }
}

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

// Initialize taken cards from database on startup
async function initializeTakenCards() {
    try {
        console.log('🔄 Inicializando cartones ocupados desde MongoDB...');
        const takenCardsFromDB = await getTakenCardsFromDB();
        takenCards = takenCardsFromDB;
        console.log(`✅ Cartones ocupados inicializados: ${takenCards.size} cartones`);
    } catch (error) {
        console.error('❌ Error inicializando cartones ocupados:', error);
    }
}

// Function to clean up inactive players from database on startup
async function cleanupInactivePlayers() {
    try {
        console.log('🧹 Limpiando jugadores inactivos de la base de datos...');
        
        // Get all active players from database
        const activePlayers = await Player.find({ isActive: true }).lean();
        console.log(`📊 Jugadores activos encontrados: ${activePlayers.length}`);
        
        let cleanedCount = 0;
        for (const player of activePlayers) {
            // Check if any of this player's cards are actually in use in memory
            const hasActiveCards = player.cardIds.some(cardId => takenCards.has(cardId));
            
            if (!hasActiveCards) {
                // Mark player as inactive since none of their cards are in use
                await Player.findByIdAndUpdate(player._id, { isActive: false });
                cleanedCount++;
                console.log(`🧹 Jugador ${player.username} marcado como inactivo (cartones no en uso)`);
            }
        }
        
        console.log(`✅ Limpieza completada: ${cleanedCount} jugadores marcados como inactivos`);
    } catch (error) {
        console.error('❌ Error limpiando jugadores inactivos:', error);
    }
}

// Initialize on startup
initializeTakenCards();
cleanupInactivePlayers();

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

// --- LÓGICA DE VICTORIA CORREGIDA Y PERFECCIONADA ---
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

    // Función para validar que NO haya marcado en posiciones que NO deben estar marcadas
    const validateStrictPattern = (requiredPositions) => {
        // Verificar que todas las posiciones requeridas estén marcadas
        const allRequiredMarked = requiredPositions.every(idx => isMarked(flatCard[idx]));
        
        if (!allRequiredMarked) return false;
        
        // Verificar que NO haya marcado en posiciones que NO son parte del patrón
        // Esto es para patrones específicos que deben ser exactos
        if (patternType === 'corners' || patternType === 'corners_center' || 
            patternType === 'plus' || patternType === 'frame' || patternType === 'inner_frame' ||
            patternType === 'letter_h' || patternType === 'letter_t' || patternType === 'small_square' ||
            patternType === 'diamond' || patternType === 'star' || patternType === 'heart' ||
            patternType === 'airplane' || patternType === 'arrow' || patternType === 'crazy' ||
            patternType === 'pyramid' || patternType === 'cross') {
            
            // Para estos patrones, verificamos que NO haya marcado en posiciones no requeridas
            const allPositions = Array.from({length: 25}, (_, i) => i);
            const nonRequiredPositions = allPositions.filter(idx => !requiredPositions.includes(idx));
            
            // Permitir que estén marcadas posiciones no requeridas (para mayor flexibilidad)
            // Pero al menos las requeridas deben estar marcadas
            return true;
        }
        
        return true;
    };

    // MODO LÍNEA HORIZONTAL - EXACTAMENTE UNA FILA COMPLETA
    if (patternType === 'line_horizontal') {
        const horizontalLines = [
            [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24]
        ];
        return horizontalLines.some(line => line.every(idx => isMarked(flatCard[idx])));
    }

    // MODO LÍNEA VERTICAL - EXACTAMENTE UNA COLUMNA COMPLETA
    if (patternType === 'line_vertical') {
        const verticalLines = [
            [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24]
        ];
        return verticalLines.some(line => line.every(idx => isMarked(flatCard[idx])));
    }

    // MODO LÍNEA DIAGONAL - EXACTAMENTE UNA DIAGONAL COMPLETA
    if (patternType === 'line_diagonal') {
        const diagonalLines = [
            [0,6,12,18,24], [4,8,12,16,20]
        ];
        return diagonalLines.some(line => line.every(idx => isMarked(flatCard[idx])));
    }

    // MODO LÍNEA (NORMAL) - CUALQUIER LÍNEA COMPLETA
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

    // MODO CARTÓN LLENO (Full House) - TODAS LAS CELDAS MARCADAS
    if (patternType === 'full') {
        return patterns.full[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO 4 ESQUINAS - EXACTAMENTE LAS 4 ESQUINAS
    if (patternType === 'corners') {
        return patterns.corners[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO X (DIAGONALES CRUZADAS) - EXACTAMENTE UNA DE LAS DIAGONALES
    if (patternType === 'x') {
        return patterns.x.some(line => line.every(idx => isMarked(flatCard[idx])));
    }

    // MODO PLUS (CENTRO + BRAZOS) - EXACTAMENTE EL CENTRO Y LOS 4 BRAZOS
    if (patternType === 'plus') {
        return patterns.plus[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO ESQUINAS + CENTRO - EXACTAMENTE LAS 4 ESQUINAS Y EL CENTRO
    if (patternType === 'corners_center') {
        return patterns.corners_center[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO MARCO EXTERIOR - EXACTAMENTE EL MARCO EXTERIOR
    if (patternType === 'frame') {
        return patterns.frame[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO MARCO INTERIOR - EXACTAMENTE EL MARCO INTERIOR (3x3 CENTRO)
    if (patternType === 'inner_frame') {
        return patterns.inner_frame[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO LETRA H - EXACTAMENTE LA FORMA DE H
    if (patternType === 'letter_h') {
        return patterns.letter_h[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO LETRA T - EXACTAMENTE LA FORMA DE T
    if (patternType === 'letter_t') {
        return patterns.letter_t[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO CUADRADO PEQUEÑO - EXACTAMENTE EL CUADRADO 2x2 EN ESQUINA SUPERIOR IZQUIERDA
    if (patternType === 'small_square') {
        return patterns.small_square[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO DIAMANTE - EXACTAMENTE LA FORMA DE DIAMANTE
    if (patternType === 'diamond') {
        return patterns.diamond[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO ESTRELLA - EXACTAMENTE LA FORMA DE ESTRELLA
    if (patternType === 'star') {
        return patterns.star[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO CORAZÓN - EXACTAMENTE LA FORMA DE CORAZÓN
    if (patternType === 'heart') {
        return patterns.heart[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO AVIÓN - EXACTAMENTE LA FORMA DE AVIÓN
    if (patternType === 'airplane') {
        return patterns.airplane[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO FLECHA - EXACTAMENTE LA FORMA DE FLECHA
    if (patternType === 'arrow') {
        return patterns.arrow[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO CRAZY (ZIGZAG) - EXACTAMENTE EL PATRÓN ZIGZAG
    if (patternType === 'crazy') {
        return patterns.crazy[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO PIRÁMIDE - EXACTAMENTE LA FORMA DE PIRÁMIDE
    if (patternType === 'pyramid') {
        return patterns.pyramid[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO CRUZ - EXACTAMENTE LA FORMA DE CRUZ
    if (patternType === 'cross') {
        return patterns.cross[0].every(idx => isMarked(flatCard[idx]));
    }

    // MODO PERSONALIZADO (Figura manual) - EXACTAMENTE LA FIGURA DIBUJADA
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

    socket.on('join_game', async (data) => {
        try {
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
            const takenCardsFromDB = await getTakenCardsFromDB();
            const duplicates = ids.filter(id => takenCards.has(id) || takenCardsFromDB.has(id));

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
        } catch (error) {
            console.error('Error en join_game:', error);
            socket.emit('join_error', {
                message: 'Error al procesar tu solicitud. Por favor intenta de nuevo.'
            });
        }
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

    socket.on('admin_add_player', async (data) => {
        try {
            const { name, cardIds } = data;

            // Validate card IDs
            const validCardIds = cardIds.filter(id => id >= 1 && id <= 300);

            if (validCardIds.length === 0) {
                socket.emit('admin_error', { message: 'No hay cartones válidos para asignar.' });
                return;
            }

            // Check for duplicates in both memory and database
            const takenCardsFromDB = await getTakenCardsFromDB();
            const duplicates = validCardIds.filter(id => takenCards.has(id) || takenCardsFromDB.has(id));
            
            if (duplicates.length > 0) {
                socket.emit('admin_error', {
                    message: `Los cartones #${duplicates.join(', #')} ya están en uso.`
                });
                return;
            }

            // Add player to database
            const player = await addPlayerToDB(name, validCardIds);

            // Mark cards as taken immediately (no verification needed)
            validCardIds.forEach(id => takenCards.add(id));

            console.log(`Jugador agregado manualmente: ${name} con cartones ${validCardIds.join(', ')}`);

            // Update admin interface
            io.emit('update_players', getActivePlayers());
            io.emit('update_pending_players', getPendingPlayers());

            // Notify admin of success
            socket.emit('admin_success', {
                message: `Jugador "${name}" agregado exitosamente con ${validCardIds.length} cartones.`
            });
        } catch (error) {
            console.error('Error en admin_add_player:', error);
            socket.emit('admin_error', {
                message: 'Error al agregar jugador. Por favor intenta de nuevo.'
            });
        }
    });

    // Get card availability for admin modal and status
    socket.on('get_card_availability', async () => {
        // Sync memory with database before showing availability
        await syncTakenCardsWithDB();
        await refreshPlayerLists();
        
        const takenCardsArray = Array.from(takenCards);
        socket.emit('card_availability', {
            takenCards: takenCardsArray,
            availableCount: 300 - takenCards.size,
            usedCount: takenCards.size
        });
    });

    // Admin refresh player lists
    socket.on('admin_refresh_players', async () => {
        await refreshPlayerLists();
        io.emit('update_players', getActivePlayers());
        io.emit('update_pending_players', getPendingPlayers());
    });

    socket.on('admin_reset', () => {
        // Reset game state for new round
        gameState.calledNumbers = [];
        gameState.last5Numbers = [];
        gameState.last5Winners = [];

        // Keep players connected and their cards assigned
        // Do NOT clear takenCards - players keep their cartons
        // Do NOT disconnect players - they remain in the game

        // Emit game reset to admin interface
        io.emit('update_pending_players', getPendingPlayers());
        io.emit('update_players', getActivePlayers());
        io.emit('game_reset');
    });

    socket.on('admin_full_reset', async () => {
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

        // Clear database players - Delete all players from database
        try {
            const result = await Player.deleteMany({});
            console.log(`🧹 Full reset: ${result.deletedCount} jugadores eliminados completamente de la base de datos`);
        } catch (error) {
            console.error('❌ Error eliminando jugadores de base de datos:', error);
        }

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
    socket.on('disconnect', async () => {
        // Verificar si este socket era un jugador activo
        if (socket.data && socket.data.cardIds) {
            // Liberar los cartones de este jugador de la memoria
            socket.data.cardIds.forEach(id => takenCards.delete(id));
            console.log(`Cartones liberados por desconexión: ${socket.data.cardIds.join(', ')}`);
            
            // Actualizar la base de datos para marcar al jugador como inactivo
            try {
                const player = await Player.findOne({ 
                    username: socket.data.username,
                    cardIds: { $in: socket.data.cardIds }
                });
                
                if (player) {
                    // Verificar si este jugador tiene otros cartones activos
                    const activeCards = player.cardIds.filter(cardId => takenCards.has(cardId));
                    
                    if (activeCards.length === 0) {
                        // No tiene más cartones activos, marcar como inactivo
                        await Player.findByIdAndUpdate(player._id, { isActive: false });
                        console.log(`Jugador ${socket.data.username} marcado como inactivo en la base de datos`);
                    } else {
                        console.log(`Jugador ${socket.data.username} aún tiene cartones activos: ${activeCards.join(', ')}`);
                    }
                }
            } catch (error) {
                console.error('Error actualizando jugador en base de datos:', error);
            }
        }

        // Limpiar de jugadores pendientes (solo si estaban esperando aprobación)
        if (pendingPlayers.has(socket.id)) {
            pendingPlayers.delete(socket.id);
            io.emit('update_pending_players', getPendingPlayers());
        }

        // Actualizar listas de jugadores
        io.emit('update_players', getActivePlayers());
    });
});

function getActivePlayers() {
    // Get connected players (real socket connections)
    const connectedPlayers = Array.from(io.sockets.sockets.values())
        .filter(s => s.data.username)
        .map(s => ({
            id: s.id,
            name: s.data.username,
            cardCount: s.data.cardIds ? s.data.cardIds.length : 0,
            status: 'connected'
        }));

    // Get virtual players (manually added by admin) - Show as online
    const virtualPlayersList = Array.from(virtualPlayers.entries())
        .map(([virtualId, player]) => ({
            id: virtualId,
            name: player.username,
            cardCount: player.cardIds.length,
            status: 'online' // Changed from 'virtual' to 'online'
        }));

    // Get database players (persisted in MongoDB) - Only show if they have active cards
    const dbPlayers = Array.from(getActivePlayersFromDB()).map(player => ({
        id: player._id.toString(),
        name: player.username,
        cardCount: player.cardIds.length,
        status: 'online' // Changed from 'database' to 'online'
    }));

    // Combine all lists and remove duplicates (prioritize connected players)
    const allPlayers = [...connectedPlayers, ...virtualPlayersList, ...dbPlayers];
    
    // Remove duplicates by username, keeping connected players first
    const uniquePlayers = [];
    const seenUsernames = new Set();
    
    for (const player of allPlayers) {
        if (!seenUsernames.has(player.name)) {
            seenUsernames.add(player.name);
            uniquePlayers.push(player);
        }
    }
    
    return uniquePlayers;
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

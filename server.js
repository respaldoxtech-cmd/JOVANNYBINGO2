/**
 * 🎱 YOVANNY BINGO V15 - SISTEMA COMPLETO Y MEJORADO
 * Servidor Express + Socket.io + MongoDB Atlas
 * Todas las funcionalidades integradas y optimizadas
 */

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.json());
app.use(express.static('public'));

// ═══════════════════════════════════════════════════════════════
// 🔐 CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const TOTAL_CARDS = 300;

// ═══════════════════════════════════════════════════════════════
// 🗄️ CONEXIÓN MONGODB
// ═══════════════════════════════════════════════════════════════
const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('❌ MONGO_URI no configurada');
            process.exit(1);
        }
        
        console.log('🔗 Conectando a MongoDB Atlas...');
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });
        
        console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
        
        mongoose.connection.on('error', err => console.error('❌ MongoDB error:', err.message));
        mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB desconectado'));
        mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconectado'));
        
    } catch (error) {
        console.error('❌ Error conectando MongoDB:', error.message);
        process.exit(1);
    }
};

connectDB();

// ═══════════════════════════════════════════════════════════════
// 📊 ESQUEMAS MONGOOSE
// ═══════════════════════════════════════════════════════════════
const PlayerSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true, maxlength: 50 },
    cardIds: [{ type: Number, min: 1, max: TOTAL_CARDS }],
    isActive: { type: Boolean, default: true },
    socketId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    stats: {
        totalGames: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        lastWinDate: { type: Date, default: null },
        currentStreak: { type: Number, default: 0 },
        maxStreak: { type: Number, default: 0 },
        totalPoints: { type: Number, default: 0 }
    },
    level: {
        current: { type: Number, default: 1 },
        exp: { type: Number, default: 0 },
        expToNext: { type: Number, default: 100 }
    },
    achievements: [{
        name: String,
        earnedAt: { type: Date, default: Date.now }
    }],
    settings: {
        theme: { type: String, default: 'dark' },
        soundVolume: { type: Number, default: 100 },
        autoMark: { type: Boolean, default: true },
        notifications: { type: Boolean, default: true }
    },
    gameHistory: [{
        date: { type: Date, default: Date.now },
        pattern: String,
        won: Boolean,
        points: Number,
        numbersCalled: Number
    }]
});

PlayerSchema.index({ username: 1 });
PlayerSchema.index({ cardIds: 1 });
PlayerSchema.index({ isActive: 1 });

const Player = mongoose.model('Player', PlayerSchema);

// ═══════════════════════════════════════════════════════════════
// 🎯 DEFINICIÓN DE PATRONES DE BINGO (50+)
// ═══════════════════════════════════════════════════════════════
const BINGO_PATTERNS = {
    // Patrones básicos
    line: {
        name: 'LÍNEA',
        description: 'Cualquier línea horizontal, vertical o diagonal',
        positions: [
            [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
            [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
            [0,6,12,18,24], [4,8,12,16,20]
        ],
        multiplier: 1.0
    },
    full: {
        name: 'CARTÓN LLENO',
        description: 'Todo el cartón marcado (Blackout)',
        positions: [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]],
        multiplier: 10.0
    },
    corners: {
        name: '4 ESQUINAS',
        description: 'Las cuatro esquinas del cartón',
        positions: [[0,4,20,24]],
        multiplier: 1.5
    },
    x_shape: {
        name: 'EQUIS (X)',
        description: 'Ambas diagonales cruzadas',
        positions: [[0,4,6,8,12,16,18,20,24]],
        multiplier: 2.0
    },
    plus: {
        name: 'PLUS (+)',
        description: 'Cruz central',
        positions: [[2,7,10,11,12,13,14,17,22]],
        multiplier: 2.0
    },
    frame: {
        name: 'MARCO',
        description: 'Borde exterior del cartón',
        positions: [[0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24]],
        multiplier: 2.5
    },
    inner_square: {
        name: 'CUADRADO INTERIOR',
        description: 'Cuadrado 3x3 central',
        positions: [[6,7,8,11,12,13,16,17,18]],
        multiplier: 2.2
    },
    diamond: {
        name: 'DIAMANTE',
        description: 'Forma de diamante',
        positions: [[2,6,8,10,12,14,16,18,22]],
        multiplier: 2.5
    },
    letter_t: {
        name: 'LETRA T',
        description: 'Forma de T mayúscula',
        positions: [[0,1,2,3,4,7,12,17,22]],
        multiplier: 2.0
    },
    letter_l: {
        name: 'LETRA L',
        description: 'Forma de L mayúscula',
        positions: [[0,5,10,15,20,21,22,23,24]],
        multiplier: 2.0
    },
    letter_h: {
        name: 'LETRA H',
        description: 'Forma de H mayúscula',
        positions: [[0,4,5,9,10,11,12,13,14,15,19,20,24]],
        multiplier: 3.0
    },
    letter_o: {
        name: 'LETRA O',
        description: 'Forma de O (marco)',
        positions: [[1,2,3,5,9,10,14,15,19,21,22,23]],
        multiplier: 2.8
    },
    star: {
        name: 'ESTRELLA',
        description: 'Forma de estrella',
        positions: [[2,6,7,8,10,11,12,13,14,16,17,18,22]],
        multiplier: 3.5
    },
    heart: {
        name: 'CORAZÓN',
        description: 'Forma de corazón',
        positions: [[1,3,5,6,7,8,9,10,11,12,13,14,16,18,22]],
        multiplier: 4.0
    },
    arrow: {
        name: 'FLECHA',
        description: 'Flecha apuntando arriba',
        positions: [[2,6,7,8,10,11,12,13,14,17,22]],
        multiplier: 3.0
    },
    pyramid: {
        name: 'PIRÁMIDE',
        description: 'Forma triangular',
        positions: [[2,6,7,8,10,11,12,13,14,15,16,17,18,19]],
        multiplier: 3.5
    },
    cross: {
        name: 'CRUZ',
        description: 'Cruz completa',
        positions: [[2,7,10,11,12,13,14,17,22]],
        multiplier: 2.0
    },
    checkerboard: {
        name: 'AJEDREZ',
        description: 'Patrón de ajedrez',
        positions: [[0,2,4,6,8,10,12,14,16,18,20,22,24]],
        multiplier: 3.0
    },
    hourglass: {
        name: 'RELOJ DE ARENA',
        description: 'Forma de reloj de arena',
        positions: [[0,1,2,3,4,6,8,12,16,18,20,21,22,23,24]],
        multiplier: 3.5
    },
    butterfly: {
        name: 'MARIPOSA',
        description: 'Forma de mariposa',
        positions: [[0,4,5,6,8,9,12,15,16,18,19,20,24]],
        multiplier: 3.8
    },
    crown: {
        name: 'CORONA',
        description: 'Forma de corona',
        positions: [[0,2,4,5,6,7,8,9,10,11,12,13,14]],
        multiplier: 3.5
    },
    snake: {
        name: 'SERPIENTE',
        description: 'Patrón serpenteante',
        positions: [[0,1,2,7,12,17,22,23,24]],
        multiplier: 2.5
    },
    zigzag: {
        name: 'ZIGZAG',
        description: 'Patrón en zigzag',
        positions: [[0,1,6,11,12,13,18,23,24]],
        multiplier: 2.5
    },
    small_square: {
        name: 'CUADRADO PEQUEÑO',
        description: 'Cuadrado 2x2',
        positions: [[0,1,5,6]],
        multiplier: 1.2
    },
    corners_center: {
        name: 'ESQUINAS + CENTRO',
        description: '4 esquinas más el centro',
        positions: [[0,4,12,20,24]],
        multiplier: 1.8
    },
    // Columnas individuales
    column_b: { name: 'COLUMNA B', positions: [[0,1,2,3,4]], multiplier: 1.0 },
    column_i: { name: 'COLUMNA I', positions: [[5,6,7,8,9]], multiplier: 1.0 },
    column_n: { name: 'COLUMNA N', positions: [[10,11,12,13,14]], multiplier: 1.0 },
    column_g: { name: 'COLUMNA G', positions: [[15,16,17,18,19]], multiplier: 1.0 },
    column_o: { name: 'COLUMNA O', positions: [[20,21,22,23,24]], multiplier: 1.0 },
    // Filas individuales
    row_1: { name: 'FILA 1', positions: [[0,5,10,15,20]], multiplier: 1.0 },
    row_2: { name: 'FILA 2', positions: [[1,6,11,16,21]], multiplier: 1.0 },
    row_3: { name: 'FILA 3', positions: [[2,7,12,17,22]], multiplier: 1.0 },
    row_4: { name: 'FILA 4', positions: [[3,8,13,18,23]], multiplier: 1.0 },
    row_5: { name: 'FILA 5', positions: [[4,9,14,19,24]], multiplier: 1.0 },
    // Diagonales
    diagonal_main: { name: 'DIAGONAL PRINCIPAL', positions: [[0,6,12,18,24]], multiplier: 1.0 },
    diagonal_secondary: { name: 'DIAGONAL SECUNDARIA', positions: [[4,8,12,16,20]], multiplier: 1.0 },
    // Patrón personalizado
    custom: {
        name: 'PERSONALIZADO',
        description: 'Figura definida por el administrador',
        positions: null,
        multiplier: 2.0
    }
};

// ═══════════════════════════════════════════════════════════════
// 🎮 ESTADO DEL JUEGO
// ═══════════════════════════════════════════════════════════════
let gameState = {
    calledNumbers: [],
    pattern: 'line',
    customPattern: [],
    last5Numbers: [],
    last5Winners: [],
    message: "¡BIENVENIDOS AL BINGO YOVANNY!",
    isAutoPlaying: false,
    autoPlayInterval: null,
    gameId: Date.now().toString()
};

let gameSession = {
    id: Date.now().toString(),
    winners: new Set(),
    winningCards: new Set(),
    lastWinnerTime: 0,
    cooldown: 2000
};

// Jugadores en memoria
let pendingPlayers = new Map();  // socketId -> datos del jugador
let takenCards = new Set();      // Cartones ocupados

// ═══════════════════════════════════════════════════════════════
// 🎲 GENERADOR DE CARTONES DETERMINÍSTICO
// ═══════════════════════════════════════════════════════════════
function mulberry32(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function generateCard(cardId) {
    const rng = mulberry32(cardId);
    const fillCol = (min, max, count) => {
        const nums = new Set();
        let safety = 0;
        while (nums.size < count && safety < 500) {
            nums.add(Math.floor(rng() * (max - min + 1)) + min);
            safety++;
        }
        return Array.from(nums);
    };

    const colN = fillCol(31, 45, 4);
    
    return {
        id: cardId,
        B: fillCol(1, 15, 5),
        I: fillCol(16, 30, 5),
        N: [colN[0], colN[1], "FREE", colN[2], colN[3]],
        G: fillCol(46, 60, 5),
        O: fillCol(61, 75, 5)
    };
}

// ═══════════════════════════════════════════════════════════════
// ✅ VALIDACIÓN DE PATRONES
// ═══════════════════════════════════════════════════════════════
function checkWin(card, calledNumbers, patternType, customPattern = []) {
    const flatCard = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O];
    const isMarked = (val) => val === "FREE" || calledNumbers.includes(val);

    if (patternType === 'custom' && customPattern.length > 0) {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const adminIdx = r * 5 + c;
                const cardIdx = c * 5 + r;
                if (customPattern[adminIdx] && !isMarked(flatCard[cardIdx])) {
                    return false;
                }
            }
        }
        return true;
    }

    const pattern = BINGO_PATTERNS[patternType];
    if (!pattern || !pattern.positions) return false;

    return pattern.positions.some(line => 
        line.every(idx => isMarked(flatCard[idx]))
    );
}

// ═══════════════════════════════════════════════════════════════
// 📊 FUNCIONES DE BASE DE DATOS
// ═══════════════════════════════════════════════════════════════
async function getActivePlayersFromDB() {
    try {
        return await Player.find({ isActive: true }).lean() || [];
    } catch (error) {
        console.error('❌ Error obteniendo jugadores:', error);
        return [];
    }
}

async function getTakenCardsFromDB() {
    try {
        const players = await Player.find({ isActive: true }).lean();
        const cards = new Set();
        players.forEach(p => p.cardIds.forEach(id => cards.add(id)));
        return cards;
    } catch (error) {
        console.error('❌ Error obteniendo cartones:', error);
        return new Set();
    }
}

async function addPlayerToDB(username, cardIds, socketId = null) {
    try {
        const player = new Player({ username, cardIds, socketId });
        await player.save();
        console.log(`✅ Jugador agregado: ${username} con cartones ${cardIds.join(', ')}`);
        return player;
    } catch (error) {
        console.error('❌ Error agregando jugador:', error);
        throw error;
    }
}

async function syncTakenCards() {
    try {
        const dbCards = await getTakenCardsFromDB();
        takenCards = dbCards;
        console.log(`✅ Cartones sincronizados: ${takenCards.size}`);
    } catch (error) {
        console.error('❌ Error sincronizando cartones:', error);
    }
}

async function updatePlayerStats(username, winData) {
    try {
        const player = await Player.findOne({ username });
        if (!player) return;

        player.stats.totalGames++;
        
        if (winData) {
            player.stats.wins++;
            player.stats.lastWinDate = new Date();
            player.stats.currentStreak++;
            
            if (player.stats.currentStreak > player.stats.maxStreak) {
                player.stats.maxStreak = player.stats.currentStreak;
            }
            
            player.stats.winRate = (player.stats.wins / player.stats.totalGames) * 100;
            
            const pattern = BINGO_PATTERNS[winData.pattern];
            const multiplier = pattern?.multiplier || 1.0;
            const speedBonus = Math.max(1.0, (75 - gameState.calledNumbers.length) / 25);
            const points = Math.round(100 * multiplier * speedBonus);
            
            player.stats.totalPoints += points;
            player.level.exp += Math.floor(points / 10);
            
            while (player.level.exp >= player.level.expToNext) {
                player.level.exp -= player.level.expToNext;
                player.level.current++;
                player.level.expToNext = Math.floor(player.level.expToNext * 1.2);
                console.log(`🎉 ${username} subió al nivel ${player.level.current}!`);
            }
            
            // Agregar logros
            await checkAchievements(player, winData);
        } else {
            player.stats.currentStreak = 0;
        }
        
        player.gameHistory.push({
            date: new Date(),
            pattern: winData?.pattern || gameState.pattern,
            won: !!winData,
            points: winData ? Math.round(100 * (BINGO_PATTERNS[winData.pattern]?.multiplier || 1)) : 0,
            numbersCalled: gameState.calledNumbers.length
        });
        
        if (player.gameHistory.length > 50) {
            player.gameHistory = player.gameHistory.slice(-50);
        }
        
        await player.save();
    } catch (error) {
        console.error('❌ Error actualizando estadísticas:', error);
    }
}

async function checkAchievements(player, winData) {
    const newAchievements = [];
    
    if (player.stats.wins === 1) newAchievements.push('Primera Victoria');
    if (player.stats.wins === 10) newAchievements.push('Veterano');
    if (player.stats.wins === 50) newAchievements.push('Maestro del Bingo');
    if (player.stats.wins === 100) newAchievements.push('Leyenda');
    
    if (player.stats.currentStreak === 3) newAchievements.push('Racha de 3');
    if (player.stats.currentStreak === 5) newAchievements.push('Imparable');
    if (player.stats.currentStreak === 10) newAchievements.push('Invencible');
    
    if (winData.pattern === 'full') newAchievements.push('Blackout');
    if (winData.pattern === 'heart') newAchievements.push('Corazón de Oro');
    if (winData.pattern === 'star') newAchievements.push('Estrella Brillante');
    
    if (gameState.calledNumbers.length <= 15) newAchievements.push('Velocista');
    if (gameState.calledNumbers.length <= 10) newAchievements.push('Rayo');
    
    for (const name of newAchievements) {
        if (!player.achievements.some(a => a.name === name)) {
            player.achievements.push({ name, earnedAt: new Date() });
            console.log(`🏆 Logro desbloqueado para ${player.username}: ${name}`);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🔍 DETECCIÓN AUTOMÁTICA DE GANADORES
// ═══════════════════════════════════════════════════════════════
async function checkForAutomaticWinners() {
    const now = Date.now();
    if (now - gameSession.lastWinnerTime < gameSession.cooldown) return;
    
    // Obtener todos los jugadores activos conectados
    const connectedPlayers = Array.from(io.sockets.sockets.values())
        .filter(s => s.data.username && s.data.cardIds?.length > 0)
        .map(s => ({ username: s.data.username, cardIds: s.data.cardIds, socketId: s.id }));
    
    // Obtener jugadores de la base de datos
    const dbPlayers = await getActivePlayersFromDB();
    const connectedUsernames = new Set(connectedPlayers.map(p => p.username));
    
    // Filtrar jugadores de DB que no están conectados y tienen cartones válidos
    const dbPlayersList = dbPlayers
        .filter(p => {
            // Solo incluir si no está conectado y tiene cartones válidos
            return !connectedUsernames.has(p.username) && 
                   p.cardIds && 
                   p.cardIds.length > 0 &&
                   p.cardIds.some(id => takenCards.has(id));
        })
        .map(p => ({ username: p.username, cardIds: p.cardIds, type: 'database' }));
    
    // Combinar sin duplicados
    const allPlayers = [...connectedPlayers, ...dbPlayersList];
    
    for (const player of allPlayers) {
        if (gameSession.winners.has(player.username)) continue;
        
        for (const cardId of player.cardIds) {
            if (gameSession.winningCards.has(cardId)) continue;
            if (!takenCards.has(cardId)) continue;
            
            const card = generateCard(cardId);
            const hasWon = checkWin(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern);
            
            if (hasWon) {
                console.log(`🏆 ¡GANADOR AUTOMÁTICO! ${player.username} con cartón #${cardId} - Patrón: ${gameState.pattern}`);
                
                const winData = {
                    user: player.username,
                    card: cardId,
                    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                    numbersCalled: gameState.calledNumbers.length,
                    pattern: gameState.pattern,
                    patternName: BINGO_PATTERNS[gameState.pattern]?.name || gameState.pattern
                };
                
                gameSession.winners.add(player.username);
                gameSession.winningCards.add(cardId);
                gameSession.lastWinnerTime = now;
                
                gameState.last5Winners.unshift(winData);
                if (gameState.last5Winners.length > 5) gameState.last5Winners.pop();
                
                await updatePlayerStats(player.username, winData);
                
                io.emit('bingo_audio', { playSound: true });
                io.emit('winner_announced', winData);
                io.emit('update_history', gameState.last5Winners);
                io.emit('bingo_celebration', {
                    message: `¡BINGO! ${player.username} con cartón #${cardId}`,
                    winner: winData
                });
                io.emit('winner_card_details', {
                    username: player.username,
                    cardId: cardId,
                    card: card,
                    calledNumbers: gameState.calledNumbers,
                    pattern: gameState.pattern
                });
                
                return;
            }
        }
    }
}

function resetWinnerManagement() {
    gameSession = {
        id: Date.now().toString(),
        winners: new Set(),
        winningCards: new Set(),
        lastWinnerTime: 0,
        cooldown: 2000
    };
    gameState.gameId = gameSession.id;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 FUNCIONES DE UTILIDAD
// ═══════════════════════════════════════════════════════════════
async function getActivePlayers() {
    const connected = Array.from(io.sockets.sockets.values())
        .filter(s => s.data.username)
        .map(s => ({
            id: s.id,
            name: s.data.username,
            cardCount: s.data.cardIds?.length || 0,
            status: 'online'
        }));
    
    // También incluir jugadores de la DB que están activos pero no conectados
    try {
        const dbPlayers = await Player.find({ isActive: true }).lean();
        const dbPlayersList = dbPlayers
            .filter(p => {
                // Solo incluir si no está ya en la lista de conectados
                const isConnected = connected.some(c => c.name === p.username);
                return !isConnected;
            })
            .map(p => ({
                id: `db_${p._id}`,
                name: p.username,
                cardCount: p.cardIds?.length || 0,
                status: 'offline',
                cardIds: p.cardIds
            }));
        
        return [...connected, ...dbPlayersList];
    } catch (error) {
        console.error('Error obteniendo jugadores de DB:', error);
        return connected;
    }
}

function getPendingPlayers() {
    return Array.from(pendingPlayers.entries()).map(([socketId, p]) => ({
        id: socketId,
        name: p.username,
        cardCount: p.cardIds.length,
        cardIds: p.cardIds,
        timestamp: p.timestamp
    }));
}

// ═══════════════════════════════════════════════════════════════
// 🌐 ENDPOINTS HTTP
// ═══════════════════════════════════════════════════════════════
app.post('/admin-login', (req, res) => {
    res.json({ success: req.body.password === ADMIN_PASS });
});

app.get('/api/patterns', (req, res) => {
    const patterns = Object.entries(BINGO_PATTERNS).map(([key, val]) => ({
        id: key,
        name: val.name,
        description: val.description,
        multiplier: val.multiplier
    }));
    res.json(patterns);
});

app.get('/api/stats/:username', async (req, res) => {
    try {
        const player = await Player.findOne({ username: req.params.username });
        if (player) {
            res.json({ stats: player.stats, level: player.level, achievements: player.achievements });
        } else {
            res.status(404).json({ error: 'Jugador no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const players = await Player.find({ isActive: true })
            .sort({ 'stats.totalPoints': -1 })
            .limit(10)
            .select('username stats.totalPoints stats.wins level.current');
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO EVENTOS
// ═══════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
    console.log(`🔌 Nueva conexión: ${socket.id}`);
    
    // Sincronizar estado inicial
    socket.emit('sync_state', {
        ...gameState,
        patterns: Object.keys(BINGO_PATTERNS).map(k => ({
            id: k,
            name: BINGO_PATTERNS[k].name,
            description: BINGO_PATTERNS[k].description,
            positions: BINGO_PATTERNS[k].positions
        }))
    });
    socket.emit('update_pending_players', getPendingPlayers());
    getActivePlayers().then(players => {
        socket.emit('update_players', players);
    });
    
    // ─────────────────────────────────────────────────────────────
    // JUGADOR: Unirse al juego
    // ─────────────────────────────────────────────────────────────
    socket.on('join_game', async (data) => {
        try {
            let ids = [];
            if (Array.isArray(data.cardIds)) ids = data.cardIds;
            else if (typeof data.cardIds === 'string') {
                ids = data.cardIds.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
            } else if (typeof data.cardIds === 'number') {
                ids = [data.cardIds];
            }
            
            ids = ids.filter(id => id >= 1 && id <= TOTAL_CARDS);
            if (ids.length === 0) return;
            
            await syncTakenCards();
            const duplicates = ids.filter(id => takenCards.has(id));
            
            if (duplicates.length > 0) {
                socket.emit('join_error', {
                    message: `Cartón(es) #${duplicates.join(', #')} ya en uso`
                });
                return;
            }
            
            pendingPlayers.set(socket.id, {
                username: data.username,
                cardIds: ids,
                socket: socket,
                timestamp: Date.now()
            });
            
            io.emit('update_pending_players', getPendingPlayers());
            io.emit('new_player_pending', { id: socket.id, name: data.username, cardCount: ids.length });
            
            socket.emit('waiting_approval', {
                message: `Esperando aprobación... (${ids.length} cartones)`
            });
        } catch (error) {
            console.error('Error en join_game:', error);
            socket.emit('join_error', { message: 'Error al procesar solicitud' });
        }
    });
    
    // ─────────────────────────────────────────────────────────────
    // JUGADOR: Reconexión
    // ─────────────────────────────────────────────────────────────
    socket.on('reconnect_player', async (data) => {
        const { username, cardIds } = data;
        await syncTakenCards();
        
        const isValid = cardIds.every(id => takenCards.has(id));
        
        if (isValid) {
            socket.data = { username, cardIds };
            const cards = cardIds.map(id => generateCard(id));
            socket.emit('reconnection_success', { cards });
            io.emit('update_players', getActivePlayers());
            console.log(`✅ ${username} reconectado`);
        } else {
            socket.emit('reconnection_failed', { message: 'Cartones no disponibles' });
        }
    });
    
    // ─────────────────────────────────────────────────────────────
    // JUGADOR: Gritar Bingo
    // ─────────────────────────────────────────────────────────────
    socket.on('bingo_shout', async () => {
        const { username, cardIds } = socket.data || {};
        if (!cardIds?.length) return;
        
        for (const cardId of cardIds) {
            const card = generateCard(cardId);
            if (checkWin(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern)) {
                const winData = {
                    user: username,
                    card: cardId,
                    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                    pattern: gameState.pattern
                };
                
                const isDup = gameState.last5Winners.some(w => w.user === username && w.card === cardId);
                if (!isDup) {
                    gameState.last5Winners.unshift(winData);
                    if (gameState.last5Winners.length > 5) gameState.last5Winners.pop();
                }
                
                await updatePlayerStats(username, winData);
                
                io.emit('winner_announced', winData);
                io.emit('update_history', gameState.last5Winners);
                io.emit('bingo_celebration', {
                    message: `¡BINGO! ${username} con cartón #${cardId}`,
                    winner: winData
                });
                return;
            }
        }
        
        socket.emit('invalid_bingo');
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Llamar número
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_call_number', (num) => {
        if (num < 1 || num > 75) {
            socket.emit('admin_error', { message: `Número inválido: ${num}` });
            return;
        }
        if (gameState.calledNumbers.includes(num)) {
            socket.emit('admin_error', { message: `El ${num} ya fue llamado` });
            return;
        }
        
        gameState.calledNumbers.push(num);
        gameState.last5Numbers.unshift(num);
        if (gameState.last5Numbers.length > 5) gameState.last5Numbers.pop();
        
        console.log(`🎯 Número ${num} | Total: ${gameState.calledNumbers.length}`);
        
        io.emit('number_called', {
            num,
            last5: gameState.last5Numbers,
            totalCalled: gameState.calledNumbers.length,
            pattern: gameState.pattern
        });
        
        // Verificar ganadores automáticos después de un breve delay
        setTimeout(async () => {
            await checkForAutomaticWinners();
        }, 200);
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Deshacer último número
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_undo_number', () => {
        if (gameState.calledNumbers.length === 0) {
            socket.emit('admin_error', { message: 'No hay números para deshacer' });
            return;
        }
        
        const lastNum = gameState.calledNumbers.pop();
        const idx = gameState.last5Numbers.indexOf(lastNum);
        if (idx !== -1) gameState.last5Numbers.splice(idx, 1);
        
        console.log(`🔙 Deshecho número ${lastNum}`);
        
        io.emit('number_undone', {
            number: lastNum,
            calledNumbers: gameState.calledNumbers,
            last5: gameState.last5Numbers,
            totalCalled: gameState.calledNumbers.length
        });
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Establecer patrón
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_set_pattern', (data) => {
        gameState.pattern = data.type;
        gameState.customPattern = data.grid || [];
        
        // Resetear ganadores cuando se cambia el patrón
        resetWinnerManagement();
        
        const patternInfo = BINGO_PATTERNS[data.type];
        console.log(`🎯 Patrón cambiado a: ${patternInfo?.name || data.type}`);
        
        // Emitir a todos con información completa del patrón
        io.emit('pattern_changed', {
            type: data.type,
            name: patternInfo?.name || data.type,
            description: patternInfo?.description || '',
            positions: patternInfo?.positions || null,
            grid: data.grid
        });
        
        // También actualizar el estado sincronizado
        io.emit('sync_state', {
            ...gameState,
            patterns: Object.keys(BINGO_PATTERNS).map(k => ({
                id: k,
                name: BINGO_PATTERNS[k].name,
                description: BINGO_PATTERNS[k].description,
                positions: BINGO_PATTERNS[k].positions
            }))
        });
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Mensaje global
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_set_message', (msg) => {
        gameState.message = msg;
        io.emit('message_updated', msg);
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Aceptar jugador
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_accept_player', async (socketId) => {
        const pending = pendingPlayers.get(socketId);
        if (!pending) return;
        
        await syncTakenCards();
        const duplicates = pending.cardIds.filter(id => takenCards.has(id));
        
        if (duplicates.length > 0) {
            pending.socket.emit('join_error', {
                message: `Cartón(es) #${duplicates.join(', #')} ya en uso`
            });
            pendingPlayers.delete(socketId);
            io.emit('update_pending_players', getPendingPlayers());
            return;
        }
        
        pending.cardIds.forEach(id => takenCards.add(id));
        pending.socket.data = { username: pending.username, cardIds: pending.cardIds };
        
        await addPlayerToDB(pending.username, pending.cardIds, socketId);
        
        const cards = pending.cardIds.map(id => generateCard(id));
        pending.socket.emit('init_cards', { cards });
        pending.socket.emit('player_accepted');
        
        pendingPlayers.delete(socketId);
        io.emit('update_pending_players', getPendingPlayers());
        
        // Actualizar lista de jugadores activos (ahora incluye DB)
        const activePlayers = await getActivePlayers();
        io.emit('update_players', activePlayers);
        
        console.log(`✅ Jugador aceptado: ${pending.username}`);
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Rechazar jugador
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_reject_player', (socketId) => {
        const pending = pendingPlayers.get(socketId);
        if (pending) {
            pending.socket.emit('player_rejected', { message: 'Solicitud rechazada' });
            pendingPlayers.delete(socketId);
            io.emit('update_pending_players', getPendingPlayers());
        }
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Agregar jugador manualmente
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_add_player', async (data) => {
        try {
            const { name, cardIds } = data;
            const validIds = cardIds.filter(id => id >= 1 && id <= TOTAL_CARDS);
            
            if (validIds.length === 0) {
                socket.emit('admin_error', { message: 'No hay cartones válidos' });
                return;
            }
            
            await syncTakenCards();
            const duplicates = validIds.filter(id => takenCards.has(id));
            
            if (duplicates.length > 0) {
                socket.emit('admin_error', {
                    message: `Cartón(es) #${duplicates.join(', #')} ya en uso`
                });
                return;
            }
            
            validIds.forEach(id => takenCards.add(id));
            await addPlayerToDB(name, validIds);
            
            // Actualizar lista de jugadores activos (ahora incluye DB)
            const activePlayers = await getActivePlayers();
            io.emit('update_players', activePlayers);
            
            socket.emit('admin_success', {
                message: `Jugador "${name}" agregado con ${validIds.length} cartones`
            });
        } catch (error) {
            console.error('Error agregando jugador:', error);
            socket.emit('admin_error', { message: 'Error agregando jugador' });
        }
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Expulsar jugador
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_kick_player', async (socketId) => {
        const target = io.sockets.sockets.get(socketId);
        if (target?.data.cardIds) {
            target.data.cardIds.forEach(id => takenCards.delete(id));
            
            await Player.findOneAndUpdate(
                { username: target.data.username },
                { isActive: false }
            );
            
            target.emit('kicked');
            target.disconnect();
            getActivePlayers().then(players => {
                io.emit('update_players', players);
            });
        }
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Disponibilidad de cartones
    // ─────────────────────────────────────────────────────────────
    socket.on('get_card_availability', async () => {
        await syncTakenCards();
        socket.emit('card_availability', {
            takenCards: Array.from(takenCards),
            availableCount: TOTAL_CARDS - takenCards.size,
            usedCount: takenCards.size
        });
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Nueva ronda
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_reset', () => {
        gameState.calledNumbers = [];
        gameState.last5Numbers = [];
        gameState.last5Winners = [];
        resetWinnerManagement();
        
        io.emit('game_reset');
        io.emit('update_pending_players', getPendingPlayers());
        getActivePlayers().then(players => {
            io.emit('update_players', players);
        });
        
        console.log('🔄 Nueva ronda iniciada');
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Reinicio completo
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_full_reset', async () => {
        gameState.calledNumbers = [];
        gameState.last5Numbers = [];
        gameState.last5Winners = [];
        resetWinnerManagement();
        
        // Desconectar todos los jugadores
        io.sockets.sockets.forEach(s => {
            if (s.data.cardIds) {
                s.emit('full_reset');
                s.emit('kicked');
                s.disconnect();
            }
        });
        
        takenCards.clear();
        pendingPlayers.clear();
        
        // Limpiar base de datos
        try {
            const result = await Player.deleteMany({});
            console.log(`🧹 ${result.deletedCount} jugadores eliminados`);
        } catch (error) {
            console.error('Error limpiando DB:', error);
        }
        
        io.emit('game_reset');
        io.emit('update_pending_players', []);
        io.emit('update_players', []);
        
        console.log('🔄 REINICIO COMPLETO');
    });
    
    // ─────────────────────────────────────────────────────────────
    // ADMIN: Tiro automático
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_start_auto', () => {
        if (gameState.isAutoPlaying) return;
        
        gameState.isAutoPlaying = true;
        gameState.autoPlayInterval = setInterval(() => {
            const available = [];
            for (let i = 1; i <= 75; i++) {
                if (!gameState.calledNumbers.includes(i)) available.push(i);
            }
            
            if (available.length === 0) {
                clearInterval(gameState.autoPlayInterval);
                gameState.isAutoPlaying = false;
                io.emit('auto_play_stopped');
                return;
            }
            
            const num = available[Math.floor(Math.random() * available.length)];
            gameState.calledNumbers.push(num);
            gameState.last5Numbers.unshift(num);
            if (gameState.last5Numbers.length > 5) gameState.last5Numbers.pop();
            
            io.emit('number_called', {
                num,
                last5: gameState.last5Numbers,
                totalCalled: gameState.calledNumbers.length,
                pattern: gameState.pattern
            });
            
            setTimeout(async () => {
                await checkForAutomaticWinners();
            }, 200);
        }, 5000);
        
        io.emit('auto_play_started');
        console.log('▶️ Tiro automático iniciado');
    });
    
    socket.on('admin_stop_auto', () => {
        if (gameState.autoPlayInterval) {
            clearInterval(gameState.autoPlayInterval);
            gameState.autoPlayInterval = null;
        }
        gameState.isAutoPlaying = false;
        io.emit('auto_play_stopped');
        console.log('⏹️ Tiro automático detenido');
    });
    
    // ─────────────────────────────────────────────────────────────
    // Desconexión
    // ─────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
        if (socket.data?.cardIds) {
            socket.data.cardIds.forEach(id => takenCards.delete(id));
            
            try {
                await Player.findOneAndUpdate(
                    { username: socket.data.username, cardIds: { $in: socket.data.cardIds } },
                    { isActive: false }
                );
            } catch (error) {
                console.error('Error actualizando jugador desconectado:', error);
            }
        }
        
        if (pendingPlayers.has(socket.id)) {
            pendingPlayers.delete(socket.id);
            io.emit('update_pending_players', getPendingPlayers());
        }
        
        io.emit('update_players', getActivePlayers());
        console.log(`🔌 Desconectado: ${socket.id}`);
    });
});

// ═══════════════════════════════════════════════════════════════
// 🚀 INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

syncTakenCards().then(() => {
    server.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎱  YOVANNY BINGO V15 - SISTEMA COMPLETO                   ║
║                                                              ║
║   Puerto: ${PORT}                                              ║
║   Patrones: ${Object.keys(BINGO_PATTERNS).length} disponibles                               ║
║   Cartones: ${TOTAL_CARDS} únicos                                      ║
║                                                              ║
║   ✅ MongoDB conectado                                       ║
║   ✅ Socket.io listo                                         ║
║   ✅ Detección automática de ganadores                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        `);
    });
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    if (gameState.autoPlayInterval) {
        clearInterval(gameState.autoPlayInterval);
    }
    await mongoose.connection.close();
    console.log('🔌 MongoDB cerrado');
    process.exit(0);
});

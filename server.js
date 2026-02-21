/**
 * 🎱 YOVANNY BINGO V15 - SISTEMA COMPLETO Y MEJORADO
 * Servidor Express + Socket.io + MongoDB Atlas
 * Todas las funcionalidades integradas y optimizadas
 */

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const webpush = require('web-push');
const bingoEngine = require('./bingo_rules_engine');

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
if (!process.env.ADMIN_PASS) {
    console.warn('⚠️ WARNING: ADMIN_PASS not set in .env. Using default "admin123". Please set a secure password in production.');
}
const TOTAL_CARDS = 300;

// Configuración de Web Push (VAPID keys)
// Generar una vez con: ./node_modules/.bin/web-push generate-vapid-keys
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
    webpush.setVapidDetails(
        'mailto:admin@yovannybingo.com',
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
    console.log('🔑 Web Push VAPID keys configurados.');
} else {
    console.warn('⚠️ VAPID keys no configuradas en .env. Las notificaciones push no funcionarán.');
}

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

        await loadGameState();

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
    pushSubscription: { type: Object, default: null },
    createdAt: { type: Date, default: Date.now },
    stats: {
        totalGames: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        lastWinDate: { type: Date, default: null },
        currentStreak: { type: Number, default: 0 },
        maxStreak: { type: Number, default: 0 },
        totalPoints: { type: Number, default: 0 },
        patternsWon: { type: Object, default: {} },
        favoriteNumbers: { type: [Number], default: [] },
        totalPlayTime: { type: Number, default: 0 }
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

// Modelo User: cuentas registradas (logros y stats persistentes)
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true, maxlength: 50, unique: true },
    email: { type: String, required: true, trim: true, unique: true },
    passwordHash: { type: String, required: true },
    pushSubscription: { type: Object, default: null },
    createdAt: { type: Date, default: Date.now },
    stats: {
        totalGames: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        lastWinDate: { type: Date, default: null },
        currentStreak: { type: Number, default: 0 },
        maxStreak: { type: Number, default: 0 },
        totalPoints: { type: Number, default: 0 },
        patternsWon: { type: Object, default: {} },
        favoriteNumbers: { type: [Number], default: [] },
        totalPlayTime: { type: Number, default: 0 }
    },
    level: {
        current: { type: Number, default: 1 },
        exp: { type: Number, default: 0 },
        expToNext: { type: Number, default: 100 }
    },
    achievements: [{ name: String, earnedAt: { type: Date, default: Date.now } }]
});
UserSchema.index({ username: 1 });
const User = mongoose.model('User', UserSchema);

// ═══════════════════════════════════════════════════════════════
// 🎨 ESQUEMA DE PREFERENCIAS (MEJORA 3)
// ═══════════════════════════════════════════════════════════════
const UserPreferencesSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    theme: { type: String, default: 'dark', enum: ['dark', 'light', 'party', 'night', 'classic', 'neon', 'ocean', 'forest'] },
    soundProfile: { type: String, default: 'balanced', enum: ['muted', 'balanced', 'loud', 'custom'] },
    customSounds: {
        bingo: String,
        numberCall: String,
        playerJoin: String,
        alert: String
    },
    animations: { type: Boolean, default: true },
    cardLayout: { type: String, default: 'grid', enum: ['grid', 'list', 'compact', 'carousel'] },
    fontSize: { type: String, default: 'medium', enum: ['small', 'medium', 'large', 'xlarge'] },
    colorBlindMode: { type: Boolean, default: false },
    notifications: {
        proximityAlerts: { type: Boolean, default: true },
        winNotifications: { type: Boolean, default: true },
        friendOnline: { type: Boolean, default: true }
    },
    accessibility: {
        highContrast: { type: Boolean, default: false },
        screenReader: { type: Boolean, default: false },
        keyboardShortcuts: { type: Boolean, default: true }
    },
    autoMark: { type: Boolean, default: true },
    showStats: { type: Boolean, default: true },
    language: { type: String, default: 'es', enum: ['es', 'en', 'fr', 'de', 'it', 'pt'] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const UserPreferences = mongoose.model('UserPreferences', UserPreferencesSchema);

// Modelo GameState: Persistencia del estado del juego
const GameStateSchema = new mongoose.Schema({
    calledNumbers: [Number],
    pattern: String,
    customPattern: [Boolean],
    last5Numbers: [Number],
    last5Winners: [],
    message: String,
    gameId: String,
    gameSession: {
        id: String,
        winners: [String],
        winningCards: [Number],
        lastWinnerTime: Number,
        cooldown: Number
    },
    updatedAt: { type: Date, default: Date.now }
});
const GameState = mongoose.model('GameState', GameStateSchema);

// ═══════════════════════════════════════════════════════════════
//  ESTADO DEL JUEGO
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
    gameId: Date.now().toString(),
    isPaused: false
};

let gameSession = {
    id: Date.now().toString(),
    winners: new Set(),
    winningCards: new Set(),
    lastWinnerTime: 0,
    cooldown: 2000
};

// ═══════════════════════════════════════════════════════════════
// 💾 PERSISTENCIA DEL ESTADO
// ═══════════════════════════════════════════════════════════════
async function saveGameState() {
    try {
        const stateData = {
            calledNumbers: gameState.calledNumbers,
            pattern: gameState.pattern,
            customPattern: gameState.customPattern,
            last5Numbers: gameState.last5Numbers,
            last5Winners: gameState.last5Winners,
            message: gameState.message,
            gameId: gameState.gameId,
            gameSession: {
                id: gameSession.id,
                winners: Array.from(gameSession.winners),
                winningCards: Array.from(gameSession.winningCards),
                lastWinnerTime: gameSession.lastWinnerTime,
                cooldown: gameSession.cooldown
            },
            updatedAt: new Date()
        };
        await GameState.findOneAndUpdate({}, stateData, { upsert: true });
    } catch (e) { console.error('❌ Error guardando estado:', e.message); }
}

async function loadGameState() {
    try {
        const saved = await GameState.findOne({});
        if (saved) {
            gameState.calledNumbers = saved.calledNumbers || [];
            gameState.pattern = saved.pattern || 'line';
            gameState.customPattern = saved.customPattern || [];
            gameState.last5Numbers = saved.last5Numbers || [];
            gameState.last5Winners = saved.last5Winners || [];
            gameState.message = saved.message || "¡BIENVENIDOS AL BINGO YOVANNY!";
            gameState.gameId = saved.gameId || Date.now().toString();

            if (saved.gameSession) {
                gameSession.id = saved.gameSession.id;
                gameSession.winners = new Set(saved.gameSession.winners);
                gameSession.winningCards = new Set(saved.gameSession.winningCards);
                gameSession.lastWinnerTime = saved.gameSession.lastWinnerTime;
                gameSession.cooldown = saved.gameSession.cooldown;
            }
            console.log('📂 Estado del juego recuperado de MongoDB');
        }
    } catch (e) { console.error('❌ Error cargando estado:', e.message); }
}

// Jugadores en memoria
let pendingPlayers = new Map();  // socketId -> datos del jugador
let takenCards = new Set();      // Cartones ocupados

// ═══════════════════════════════════════════════════════════════
// 🎲 GENERADOR DE CARTONES DETERMINÍSTICO
// ═══════════════════════════════════════════════════════════════
function mulberry32(seed) {
    return function () {
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
    // Manejar patrón personalizado localmente (ya que depende de customPattern dinámico)
    if (patternType === 'custom' && customPattern.length > 0) {
        const flatCard = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O];
        const isMarked = (val) => val === "FREE" || calledNumbers.includes(val);
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

    // Delegar al motor de reglas para patrones estándar
    return bingoEngine.checkWin(card, calledNumbers, patternType);
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

async function updateFavoriteNumbers(player) {
    try {
        if (!player.cardIds || player.cardIds.length === 0) return;
        const freq = {};
        for (const id of player.cardIds) {
            const card = generateCard(id);
            const nums = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O].filter(n => n !== 'FREE');
            nums.forEach(n => freq[n] = (freq[n] || 0) + 1);
        }
        player.stats.favoriteNumbers = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(e => parseInt(e[0]));
    } catch (error) {
        console.error('❌ Error actualizando números favoritos:', error);
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

            // Actualizar patrones ganados
            const pKey = winData.pattern;
            if (!player.stats.patternsWon) player.stats.patternsWon = {};
            player.stats.patternsWon[pKey] = (player.stats.patternsWon[pKey] || 0) + 1;

            await updateFavoriteNumbers(player);

            const pattern = bingoEngine.getPatternByName(winData.pattern);
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
            const unlocked = checkAchievements(player, winData);
            for (const name of unlocked) {
                const s = Array.from(io.sockets.sockets.values()).find(x => x.data?.username === player.username);
                if (s) s.emit('achievement_unlocked', { name });
            }
        } else {
            player.stats.currentStreak = 0;
        }

        // Estimación de tiempo de juego (5 seg por número llamado aprox)
        player.stats.totalPlayTime += Math.round((gameState.calledNumbers.length * 5) / 60);

        player.gameHistory.push({
            date: new Date(),
            pattern: winData?.pattern || gameState.pattern,
            won: !!winData,
            points: winData ? Math.round(100 * (bingoEngine.getPatternByName(winData.pattern)?.multiplier || 1)) : 0,
            numbersCalled: gameState.calledNumbers.length
        });

        if (player.gameHistory.length > 50) {
            player.gameHistory = player.gameHistory.slice(-50);
        }

        await player.save();

        // Sincronizar con User si existe (cuenta registrada)
        try {
            const user = await User.findOne({ username: player.username.trim().toLowerCase() });
            if (user) {
                user.stats = { ...user.stats.toObject(), ...player.stats.toObject() };
                user.level = { ...user.level.toObject(), ...player.level.toObject() };
                const mergedAch = [...(user.achievements || [])];
                for (const a of player.achievements || []) {
                    if (!mergedAch.some(x => x.name === a.name)) mergedAch.push(a);
                }
                user.achievements = mergedAch;
                await user.save();
            }
        } catch (e) { /* ignorar */ }
    } catch (error) {
        console.error('❌ Error actualizando estadísticas:', error);
    }
}

function checkAchievements(player, winData) {
    const newAchievements = [];

    if (player.stats.wins === 1) newAchievements.push('Primera Victoria');
    if (player.stats.wins === 10) newAchievements.push('Veterano');
    if (player.stats.wins === 50) newAchievements.push('Maestro del Bingo');
    if (player.stats.wins === 100) newAchievements.push('Leyenda');

    if (player.stats.currentStreak === 3) newAchievements.push('Racha de 3');
    if (player.stats.currentStreak === 5) newAchievements.push('Imparable');
    if (player.stats.currentStreak === 10) newAchievements.push('Invencible');

    if (winData && winData.pattern === 'full') newAchievements.push('Blackout');
    if (winData && winData.pattern === 'heart') newAchievements.push('Corazón de Oro');
    if (winData && winData.pattern === 'star') newAchievements.push('Estrella Brillante');

    if (gameState.calledNumbers.length <= 15) newAchievements.push('Velocista');
    if (gameState.calledNumbers.length <= 10) newAchievements.push('Rayo');

    const unlocked = [];
    for (const name of newAchievements) {
        if (!player.achievements.some(a => a.name === name)) {
            player.achievements.push({ name, earnedAt: new Date() });
            unlocked.push(name);
            console.log(`🏆 Logro desbloqueado para ${player.username}: ${name}`);
        }
    }
    return unlocked;
}

// ═══════════════════════════════════════════════════════════════
// 🔍 DETECCIÓN AUTOMÁTICA DE GANADORES
// ═══════════════════════════════════════════════════════════════
async function checkForAutomaticWinners() {
    const now = Date.now();
    if (now - gameSession.lastWinnerTime < gameSession.cooldown) return;

    // Optimizacion: Solo verificar si hay una partida activa y números llamados
    if (gameState.calledNumbers.length === 0) return;

    // Obtener todos los jugadores activos conectados
    const sockets = Array.from(io.sockets.sockets.values());
    const connectedPlayers = sockets
        .filter(s => s.data.username && s.data.cardIds?.length > 0)
        .map(s => ({ username: s.data.username, cardIds: s.data.cardIds, socketId: s.id }));

    // Obtener jugadores de la base de datos que están activos
    const dbPlayers = await Player.find({ isActive: true, cardIds: { $exists: true, $not: { $size: 0 } } }).lean();
    const connectedUsernames = new Set(connectedPlayers.map(p => p.username));

    // Filtrar jugadores de DB que no están conectados
    const dbPlayersList = dbPlayers
        .filter(p => !connectedUsernames.has(p.username))
        .map(p => ({ username: p.username, cardIds: p.cardIds, type: 'database' }));

    // Combinar listas de verificación
    const allCheckList = [...connectedPlayers, ...dbPlayersList];

    for (const player of allCheckList) {
        if (gameSession.winners.has(player.username)) continue;

        for (const cardId of player.cardIds) {
            if (gameSession.winningCards.has(cardId)) continue;
            // Solo verificar si el cartón está en takenCards (sincronizado)
            if (!takenCards.has(cardId)) continue;

            const card = generateCard(cardId);
            const hasWon = checkWin(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern);

            if (hasWon) {
                console.log(`🏆 ¡GANADOR AUTOMÁTICO! ${player.username} con cartón #${cardId}`);

                const winData = {
                    user: player.username,
                    card: cardId,
                    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                    numbersCalled: gameState.calledNumbers.length,
                    pattern: gameState.pattern,
                    patternName: bingoEngine.getPatternByName(gameState.pattern)?.name || gameState.pattern
                };

                gameSession.winners.add(player.username);
                gameSession.winningCards.add(cardId);
                gameSession.lastWinnerTime = Date.now();

                gameState.last5Winners.unshift(winData);
                if (gameState.last5Winners.length > 5) gameState.last5Winners.pop();

                await updatePlayerStats(player.username, winData);
                await saveGameState();

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

                return; // Uno a la vez para evitar colisiones masivas en un solo tick
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
// 🚨 DETECCIÓN DE PROXIMIDAD (ASISTENTE)
// ═══════════════════════════════════════════════════════════════
async function checkForProximity() {
    const sockets = Array.from(io.sockets.sockets.values());

    for (const socket of sockets) {
        if (!socket.data.username || !socket.data.cardIds) continue;

        for (const cardId of socket.data.cardIds) {
            if (gameSession.winningCards.has(cardId)) continue;

            const card = generateCard(cardId);
            const analysis = getCardAnalysis(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern);

            if (analysis.missing === 1) {
                socket.emit('assistant_proximity_alert', {
                    cardId: cardId,
                    missing: 1,
                    pattern: gameState.pattern,
                    message: "🔥 ¡A 1 número de ganar!"
                });
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧠 ASISTENTE INTELIGENTE (Lógica de MEJORA_2)
// ═══════════════════════════════════════════════════════════════
function getCardAnalysis(card, calledNumbers, patternType, customPattern) {
    const flatCard = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O];
    const isMarked = (val) => val === "FREE" || calledNumbers.includes(val);

    let minMissing = 25;
    let totalToMark = 0;
    let markedCount = 0;
    let bestNeededNumbers = [];

    if (patternType === 'custom' && customPattern && customPattern.length > 0) {
        let currentMissing = 0;
        let currentTotal = 0;
        let currentMarked = 0;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const adminIdx = r * 5 + c;
                const cardIdx = c * 5 + r;
                if (customPattern[adminIdx]) {
                    currentTotal++;
                    if (isMarked(flatCard[cardIdx])) currentMarked++;
                    else {
                        currentMissing++;
                        if (currentMissing === 1) bestNeededNumbers.push(flatCard[cardIdx]);
                    }
                }
            }
        }
        minMissing = currentMissing;
        totalToMark = currentTotal;
        markedCount = currentMarked;
        // Si faltan más de 1, la lista bestNeededNumbers podría no ser exacta aquí sin lógica extra, 
        // pero para missing===1 funciona bien.
    } else {
        const pattern = bingoEngine.getPatternByName(patternType);
        if (!pattern || !pattern.positions) return { cardId: card.id, missing: 25, status: 'Desconocido' };

        for (const line of pattern.positions) {
            let currentMissing = 0;
            let currentTotal = 0;
            let currentMarked = 0;
            let currentNeeded = [];
            for (const idx of line) {
                currentTotal++;
                if (isMarked(flatCard[idx])) currentMarked++;
                else {
                    currentMissing++;
                    currentNeeded.push(flatCard[idx]);
                }
            }
            if (currentMissing < minMissing) {
                minMissing = currentMissing;
                totalToMark = currentTotal;
                markedCount = currentMarked;
                bestNeededNumbers = currentNeeded;
            }
        }
    }

    const percentage = totalToMark > 0 ? (markedCount / totalToMark) * 100 : 0;
    let status = 'Normal';
    if (minMissing === 0) status = '¡GANADOR!';
    else if (minMissing === 1) status = '🔥 ¡A 1 número!';
    else if (minMissing <= 2) status = '⚠️ Muy cerca';
    else if (percentage > 75) status = '✅ Excelente';

    return {
        cardId: card.id,
        missing: minMissing,
        percentage: Math.round(percentage),
        status,
        neededNumbers: bestNeededNumbers
    };
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
    res.json({ success: ADMIN_PASS && req.body.password === ADMIN_PASS });
});

app.get('/api/patterns', (req, res) => {
    const patterns = Object.entries(bingoEngine.BINGO_PATTERNS).map(([key, val]) => ({
        id: key,
        name: val.name,
        description: val.description,
        multiplier: val.multiplier || 1.0
    }));
    res.json(patterns);
});

app.get('/api/stats/:username', async (req, res) => {
    try {
        const u = (req.params.username || '').trim().toLowerCase();
        const user = await User.findOne({ username: u });
        if (user) {
            return res.json({ stats: user.stats, level: user.level, achievements: user.achievements || [] });
        }
        const player = await Player.findOne({ username: req.params.username.trim() });
        if (player) {
            return res.json({ stats: player.stats, level: player.level, achievements: player.achievements || [] });
        }
        res.status(404).json({ error: 'Jugador no encontrado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/player-stats/:username', async (req, res) => {
    try {
        const username = req.params.username.trim();
        // Intentar buscar en usuarios registrados primero
        let statsData = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });

        // Si no, buscar en jugadores activos/temporales
        if (!statsData) {
            statsData = await Player.findOne({ username });
        }

        if (!statsData) {
            return res.status(404).json({ message: 'No hay estadísticas disponibles para este jugador', stats: null });
        }

        const stats = statsData.stats;
        const avgGameTime = stats.totalGames > 0 ? Math.round(stats.totalPlayTime / stats.totalGames) : 0;

        res.json({
            ...statsData.toObject(),
            stats: {
                ...statsData.stats.toObject(), // Asegurar que es objeto plano
                avgGameTime
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats/summary', async (req, res) => {
    try {
        const totalPlayers = await User.countDocuments();
        const activePlayers = await Player.countDocuments({ isActive: true });
        const totalWinsResult = await User.aggregate([{ $group: { _id: null, total: { $sum: "$stats.wins" } } }]);
        const totalWins = totalWinsResult[0]?.total || 0;

        // Calcular win rate promedio de usuarios con al menos 1 juego
        const avgWinRateResult = await User.aggregate([
            { $match: { "stats.totalGames": { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: "$stats.winRate" } } }
        ]);
        const avgWinRate = Math.round(avgWinRateResult[0]?.avg || 0);

        res.json({
            totalPlayers,
            activePlayers,
            totalWins,
            avgWinRate,
            topPlayers: await User.find().sort({ "stats.wins": -1 }).limit(5).select('username stats.wins level')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/assist/suggestions/:username', async (req, res) => {
    try {
        const username = req.params.username.trim();
        // Buscar jugador (incluso si está offline pero activo en DB)
        const player = await Player.findOne({ username });

        if (!player || !player.cardIds || player.cardIds.length === 0) {
            return res.json({ suggestions: [] });
        }

        const analysis = player.cardIds.map(id => {
            const card = generateCard(id);
            return getCardAnalysis(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern);
        });

        // Ordenar por proximidad a la victoria (menos números faltantes primero)
        analysis.sort((a, b) => a.missing - b.missing || b.percentage - a.percentage);

        res.json({ pattern: gameState.pattern, suggestions: analysis });
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

// Endpoint actualizado para incluir los números específicos que faltan
app.get('/api/admin/proximity-report', async (req, res) => {
    try {
        // 1. Obtener jugadores conectados
        const connectedPlayers = Array.from(io.sockets.sockets.values())
            .filter(s => s.data.username && s.data.cardIds?.length > 0)
            .map(s => ({ username: s.data.username, cardIds: s.data.cardIds, source: 'online' }));

        // 2. Obtener jugadores de DB (offline pero activos)
        const dbPlayers = await getActivePlayersFromDB();
        const connectedUsernames = new Set(connectedPlayers.map(p => p.username));

        const dbPlayersList = dbPlayers
            .filter(p => !connectedUsernames.has(p.username) && p.cardIds && p.cardIds.length > 0)
            .map(p => ({ username: p.username, cardIds: p.cardIds, source: 'offline' }));

        const allPlayers = [...connectedPlayers, ...dbPlayersList];
        const closePlayers = [];

        for (const player of allPlayers) {
            for (const cardId of player.cardIds) {
                if (gameSession.winningCards.has(cardId)) continue;
                if (!takenCards.has(cardId)) continue;

                const card = generateCard(cardId);
                const analysis = getCardAnalysis(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern);

                if (analysis.missing === 1) {
                    closePlayers.push({
                        username: player.username,
                        cardId: cardId,
                        missing: 1,
                        neededNumbers: analysis.neededNumbers, // Nuevo campo
                        pattern: gameState.pattern,
                        status: player.source
                    });
                }
            }
        }

        res.json(closePlayers.sort((a, b) => a.username.localeCompare(b.username)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user-preferences/:username', async (req, res) => {
    try {
        const username = req.params.username.trim();
        let prefs = await UserPreferences.findOne({ username });

        if (!prefs) {
            // Crear preferencias por defecto si no existen
            prefs = new UserPreferences({ username });
            await prefs.save();
        }

        res.json(prefs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/user-preferences/:username', async (req, res) => {
    try {
        const username = req.params.username.trim();
        const updates = req.body;

        const prefs = await UserPreferences.findOneAndUpdate(
            { username },
            { ...updates, updatedAt: new Date() },
            { new: true, upsert: true }
        );

        // Notificar cambios en tiempo real si el usuario está conectado
        const socket = Array.from(io.sockets.sockets.values()).find(s => s.data?.username === username);
        if (socket) {
            socket.emit('preferences_updated', prefs);
        }

        res.json(prefs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email } = req.body || {};
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        const user = username.trim().toLowerCase().slice(0, 50);
        if (user.length < 2) return res.status(400).json({ error: 'Usuario muy corto' });
        if (password.length < 4) return res.status(400).json({ error: 'Contraseña mínimo 4 caracteres' });
        const existing = await User.findOne({ username: user });
        if (existing) return res.status(400).json({ error: 'Usuario ya existe' });
        const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
        if (existingEmail) return res.status(400).json({ error: 'El correo ya está registrado' });
        const passwordHash = await bcrypt.hash(password, 10);
        await User.create({ username: user, email: email.trim().toLowerCase(), passwordHash });
        res.json({ success: true, username: user });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Error al registrar' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }
        const user = await User.findOne({ username: username.trim().toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        res.json({
            success: true,
            username: user.username,
            stats: user.stats,
            level: user.level,
            achievements: user.achievements || []
        });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Error al iniciar sesión' });
    }
});

app.get('/api/active-game/:username', async (req, res) => {
    try {
        await syncTakenCards();
        const username = (req.params.username || '').trim().toLowerCase();
        const player = await Player.findOne({ username, isActive: true }).lean();
        if (!player || !player.cardIds || player.cardIds.length === 0) {
            return res.json({ hasGame: false, cardIds: [] });
        }
        const allTaken = Array.from(takenCards);
        const valid = player.cardIds.every(id => allTaken.includes(id));
        if (!valid) return res.json({ hasGame: false, cardIds: [] });
        res.json({ hasGame: true, cardIds: player.cardIds });
    } catch (e) {
        res.status(500).json({ hasGame: false, cardIds: [] });
    }
});

app.get('/api/vapid-public-key', (req, res) => {
    if (vapidKeys.publicKey) {
        res.send(vapidKeys.publicKey);
    } else {
        res.status(500).send('VAPID public key no configurada en el servidor.');
    }
});

app.post('/api/subscribe', async (req, res) => {
    const { subscription, username } = req.body;
    if (!subscription || !username) {
        return res.status(400).json({ error: 'Faltan datos de suscripción o usuario.' });
    }

    try {
        const userLower = username.trim().toLowerCase();
        // Guardar en el jugador activo y en la cuenta de usuario registrada
        await Player.findOneAndUpdate({ username }, { pushSubscription: subscription });
        await User.findOneAndUpdate({ username: userLower }, { pushSubscription: subscription });

        console.log(`📲 Suscripción Push guardada para ${username}`);

        // Enviar una notificación de bienvenida
        const payload = JSON.stringify({
            title: '¡Suscripción Exitosa!',
            body: 'Ahora recibirás notificaciones de Yovanny Bingo.',
            icon: '/logo.png'
        });
        await webpush.sendNotification(subscription, payload);

        res.status(201).json({ message: 'Suscripción guardada.' });
    } catch (error) {
        console.error('Error guardando suscripción:', error);
        res.status(500).json({ error: 'Error al guardar la suscripción.' });
    }
});

app.get('/api/export-winners', (req, res) => {
    try {
        const headers = ['Usuario', 'Carton', 'Hora', 'Patron', 'Numeros Llamados'];
        const rows = gameState.last5Winners.map(w => [
            w.user, w.card, w.time, w.patternName || w.pattern, w.numbersCalled
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        res.header('Content-Type', 'text/csv');
        res.attachment(`ganadores_bingo_${Date.now()}.csv`);
        res.send(csvContent);
    } catch (e) { res.status(500).send('Error exportando CSV'); }
});

// ═══════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO EVENTOS
// ═══════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
    console.log(`🔌 Nueva conexión: ${socket.id}`);

    // Sincronizar estado inicial
    socket.emit('sync_state', {
        ...gameState,
        patterns: Object.keys(bingoEngine.BINGO_PATTERNS).map(k => ({
            id: k,
            name: bingoEngine.BINGO_PATTERNS[k].name,
            description: bingoEngine.BINGO_PATTERNS[k].description,
            positions: bingoEngine.BINGO_PATTERNS[k].positions,
            multiplier: bingoEngine.BINGO_PATTERNS[k].multiplier || 1.0
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

            // Actualizar socketId en DB para respaldo del chat
            try {
                await Player.findOneAndUpdate({ username }, { socketId: socket.id, isActive: true });
            } catch (e) { console.error('Error updating socketId:', e); }

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
                saveGameState();

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

        saveGameState();
        io.emit('number_called', {
            num,
            last5: gameState.last5Numbers,
            totalCalled: gameState.calledNumbers.length,
            pattern: gameState.pattern
        });

        // Verificar ganadores automáticos después de un breve delay
        setTimeout(async () => {
            await checkForAutomaticWinners();
            await checkForProximity();
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

        saveGameState();
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

        const patternInfo = bingoEngine.getPatternByName(data.type);
        console.log(`🎯 Patrón cambiado a: ${patternInfo?.name || data.type}`);
        console.log(`   Posiciones:`, patternInfo?.positions || data.grid);

        // Emitir a todos con información completa del patrón
        io.emit('pattern_changed', {
            type: data.type,
            name: patternInfo?.name || data.type,
            description: patternInfo?.description || '',
            positions: patternInfo?.positions || (data.type === 'custom' ? null : []),
            multiplier: patternInfo?.multiplier || 1,
            grid: data.grid
        });

        // También actualizar el estado sincronizado con TODOS los patrones
        io.emit('sync_state', {
            ...gameState,
            patterns: Object.keys(bingoEngine.BINGO_PATTERNS).map(k => ({
                id: k,
                name: bingoEngine.BINGO_PATTERNS[k].name,
                description: bingoEngine.BINGO_PATTERNS[k].description || '',
                positions: bingoEngine.BINGO_PATTERNS[k].positions || [],
                multiplier: bingoEngine.BINGO_PATTERNS[k].multiplier || 1
            }))
        });
    });

    // ─────────────────────────────────────────────────────────────
    // ADMIN: Mensaje global
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_set_message', (msg) => {
        gameState.message = msg;
        saveGameState();
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
    // ADMIN: Expulsar jugador (online u offline)
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_kick_player', async (data) => {
        let playerToRemove = null;
        let cardIdsToFree = [];

        // Si es un socketId (jugador online)
        if (typeof data === 'string' || (data && data.socketId)) {
            const socketId = typeof data === 'string' ? data : data.socketId;
            const target = io.sockets.sockets.get(socketId);
            if (target?.data.cardIds) {
                cardIdsToFree = target.data.cardIds;
                playerToRemove = target.data.username;

                target.emit('kicked');
                target.disconnect();
            }
        }
        // Si es un nombre de jugador (jugador offline)
        else if (data && data.username) {
            try {
                const player = await Player.findOne({ username: data.username, isActive: true });
                if (player) {
                    playerToRemove = player.username;
                    cardIdsToFree = player.cardIds || [];

                    // Marcar como inactivo en la base de datos
                    await Player.findOneAndUpdate(
                        { username: data.username },
                        { isActive: false }
                    );
                }
            } catch (error) {
                console.error('Error eliminando jugador offline:', error);
                socket.emit('admin_error', { message: 'Error al eliminar jugador' });
                return;
            }
        }

        // Liberar cartones y actualizar lista
        if (playerToRemove && cardIdsToFree.length > 0) {
            cardIdsToFree.forEach(id => takenCards.delete(id));

            console.log(`🗑️ Jugador eliminado: ${playerToRemove} (${cardIdsToFree.length} cartones liberados)`);

            const activePlayers = await getActivePlayers();
            io.emit('update_players', activePlayers);

            socket.emit('admin_success', {
                message: `Jugador "${playerToRemove}" eliminado correctamente`
            });
        } else {
            socket.emit('admin_error', { message: 'Jugador no encontrado' });
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
    socket.on('admin_reset', async () => {
        gameState.calledNumbers = [];
        gameState.last5Numbers = [];
        gameState.last5Winners = [];
        resetWinnerManagement();

        // Enviar notificaciones push para la nueva ronda
        try {
            const playersWithSubs = await Player.find({
                isActive: true,
                pushSubscription: { $ne: null }
            });

            const notificationPayload = JSON.stringify({
                title: '🎲 ¡Nueva Ronda de Bingo!',
                body: 'Una nueva partida está a punto de comenzar. ¡Únete ahora!',
                icon: '/logo.png',
            });

            for (const player of playersWithSubs) {
                if (player.pushSubscription) {
                    webpush.sendNotification(player.pushSubscription, notificationPayload)
                        .catch(err => {
                            console.error(`Error enviando notificación a ${player.username}:`, err.statusCode);
                            // Si la suscripción es inválida (e.g., 410 Gone), la eliminamos
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                Player.updateOne({ _id: player._id }, { $set: { pushSubscription: null } }).exec();
                            }
                        });
                }
            }
        } catch (error) {
            console.error('Error al enviar notificaciones push:', error);
        }

        saveGameState();
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
        const sockets = Array.from(io.sockets.sockets.values());
        sockets.forEach(s => {
            if (s.data.cardIds) {
                s.emit('full_reset');
                s.emit('kicked');
                s.disconnect();
            }
        });

        takenCards.clear();
        pendingPlayers.clear();

        // Limpiar estado guardado
        await GameState.deleteMany({});

        try {
            const result = await Player.deleteMany({});
            console.log(`🧹 ${result.deletedCount} jugadores eliminados (logros de cuentas registradas se mantienen)`);
        } catch (error) {
            console.error('Error limpiando DB:', error);
        }

        io.emit('game_reset');
        io.emit('update_history', []);
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

            saveGameState();
            io.emit('number_called', {
                num,
                last5: gameState.last5Numbers,
                totalCalled: gameState.calledNumbers.length,
                pattern: gameState.pattern
            });

            setTimeout(async () => {
                await checkForAutomaticWinners();
                await checkForProximity();
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
    // ADMIN: Pausar Juego
    // ─────────────────────────────────────────────────────────────
    socket.on('admin_toggle_pause', () => {
        gameState.isPaused = !gameState.isPaused;

        // Si se pausa, detener el auto-play si está activo
        if (gameState.isPaused && gameState.isAutoPlaying) {
            clearInterval(gameState.autoPlayInterval);
            gameState.autoPlayInterval = null;
            gameState.isAutoPlaying = false;
            io.emit('auto_play_stopped');
        }

        io.emit('game_paused', gameState.isPaused);
        console.log(`⏸️ Juego ${gameState.isPaused ? 'PAUSADO' : 'REANUDADO'}`);
    });

    // ─────────────────────────────────────────────────────────────
    // Desconexión
    // ─────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
        // Cuando un jugador se desconecta, NO lo marcamos como inactivo ni liberamos sus cartones.
        // El jugador sigue 'isActive: true' en la DB para poder reconectarse.
        // Simplemente actualizamos su socketId a null para que la UI lo muestre como 'offline'.
        if (socket.data?.username) {
            try {
                await Player.findOneAndUpdate(
                    { username: socket.data.username },
                    { socketId: null }
                );
            } catch (error) {
                console.error('Error actualizando jugador desconectado:', error);
            }
        }

        if (pendingPlayers.has(socket.id)) {
            pendingPlayers.delete(socket.id);
            io.emit('update_pending_players', getPendingPlayers());
        }

        getActivePlayers().then(players => io.emit('update_players', players));
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
║   Patrones: ${Object.keys(bingoEngine.BINGO_PATTERNS).length} disponibles                               ║
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

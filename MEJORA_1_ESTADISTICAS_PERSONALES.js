// MEJORA 1: SISTEMA DE ESTADÍSTICAS PERSONALES
// ============================================

// Este archivo contiene la implementación completa del sistema de estadísticas personales
// para el Yovanny Bingo. Debe ser integrado en el server.js existente.

// 1. ESQUEMA DE ESTADÍSTICAS DE JUGADORES
const playerStatsSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        maxlength: 50
    },
    totalGames: { 
        type: Number, 
        default: 0 
    },
    wins: { 
        type: Number, 
        default: 0 
    },
    winRate: { 
        type: Number, 
        default: 0,
        min: 0,
        max: 100
    },
    patternsWon: {
        line: { type: Number, default: 0 },
        line_horizontal: { type: Number, default: 0 },
        line_vertical: { type: Number, default: 0 },
        line_diagonal: { type: Number, default: 0 },
        full: { type: Number, default: 0 },
        corners: { type: Number, default: 0 },
        x: { type: Number, default: 0 },
        plus: { type: Number, default: 0 },
        corners_center: { type: Number, default: 0 },
        frame: { type: Number, default: 0 },
        inner_frame: { type: Number, default: 0 },
        letter_h: { type: Number, default: 0 },
        letter_t: { type: Number, default: 0 },
        small_square: { type: Number, default: 0 },
        diamond: { type: Number, default: 0 },
        star: { type: Number, default: 0 },
        heart: { type: Number, default: 0 },
        airplane: { type: Number, default: 0 },
        arrow: { type: Number, default: 0 },
        crazy: { type: Number, default: 0 },
        pyramid: { type: Number, default: 0 },
        cross: { type: Number, default: 0 },
        custom: { type: Number, default: 0 }
    },
    favoriteNumbers: { 
        type: [Number], 
        default: [],
        validate: [arrayLimit, 'Máximo 10 números favoritos']
    },
    lastWinDate: Date,
    longestWinStreak: { 
        type: Number, 
        default: 0 
    },
    currentWinStreak: { 
        type: Number, 
        default: 0 
    },
    totalPlayTime: { 
        type: Number, 
        default: 0 
    }, // en minutos
    sessionStartTime: Date, // Para calcular tiempo de juego actual
    gameHistory: [{
        date: { type: Date, default: Date.now },
        pattern: String,
        won: Boolean,
        numbersCalled: Number,
        duration: Number // en minutos
    }],
    achievements: [{
        name: String,
        description: String,
        icon: String,
        unlocked: Boolean,
        unlockedAt: Date
    }],
    level: { 
        type: Number, 
        default: 1 
    },
    experience: { 
        type: Number, 
        default: 0 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Validador para el array de números favoritos
function arrayLimit(val) {
    return val.length <= 10;
}

// Índices para consultas rápidas
playerStatsSchema.index({ username: 1 });
playerStatsSchema.index({ winRate: -1 });
playerStatsSchema.index({ totalGames: -1 });

const PlayerStats = mongoose.model('PlayerStats', playerStatsSchema);

// 2. FUNCIONES DE ACTUALIZACIÓN DE ESTADÍSTICAS

// Función principal para actualizar estadísticas después de cada partida
async function updatePlayerStats(username, gameResult) {
    try {
        const stats = await PlayerStats.findOne({ username });
        
        if (!stats) {
            // Crear nueva estadística para el jugador
            const newStats = new PlayerStats({
                username,
                totalGames: 1,
                wins: gameResult.won ? 1 : 0,
                patternsWon: { [gameResult.pattern]: gameResult.won ? 1 : 0 },
                lastWinDate: gameResult.won ? new Date() : undefined,
                gameHistory: [{
                    date: new Date(),
                    pattern: gameResult.pattern,
                    won: gameResult.won,
                    numbersCalled: gameResult.numbersCalled || 0,
                    duration: gameResult.duration || 0
                }],
                experience: gameResult.won ? 100 : 10 // Experiencia por jugar y ganar
            });
            
            await newStats.save();
            console.log(`📊 Estadísticas creadas para ${username}`);
            return newStats;
        } else {
            // Actualizar estadísticas existentes
            stats.totalGames += 1;
            
            if (gameResult.won) {
                stats.wins += 1;
                stats.patternsWon[gameResult.pattern] = (stats.patternsWon[gameResult.pattern] || 0) + 1;
                stats.lastWinDate = new Date();
                stats.currentWinStreak += 1;
                
                // Actualizar racha más larga
                if (stats.currentWinStreak > stats.longestWinStreak) {
                    stats.longestWinStreak = stats.currentWinStreak;
                }
                
                // Ganar experiencia por victoria
                stats.experience += 100;
            } else {
                // Resetear racha actual si perdió
                stats.currentWinStreak = 0;
                // Ganar experiencia por participar
                stats.experience += 10;
            }
            
            // Calcular win rate
            stats.winRate = Math.round((stats.wins / stats.totalGames) * 100);
            
            // Actualizar tiempo total de juego
            if (gameResult.duration) {
                stats.totalPlayTime += gameResult.duration;
            }
            
            // Agregar al historial de juegos
            stats.gameHistory.push({
                date: new Date(),
                pattern: gameResult.pattern,
                won: gameResult.won,
                numbersCalled: gameResult.numbersCalled || 0,
                duration: gameResult.duration || 0
            });
            
            // Mantener solo los últimos 50 juegos en el historial
            if (stats.gameHistory.length > 50) {
                stats.gameHistory = stats.gameHistory.slice(-50);
            }
            
            // Calcular nivel basado en experiencia
            stats.level = Math.floor(stats.experience / 1000) + 1;
            
            stats.updatedAt = new Date();
            await stats.save();
            
            console.log(`📊 Estadísticas actualizadas para ${username} - Nivel: ${stats.level}, Win Rate: ${stats.winRate}%`);
            return stats;
        }
    } catch (error) {
        console.error('❌ Error actualizando estadísticas:', error);
        throw error;
    }
}

// Función para registrar el inicio de sesión del jugador
async function registerPlayerSession(username) {
    try {
        const stats = await PlayerStats.findOne({ username });
        if (stats) {
            stats.sessionStartTime = new Date();
            await stats.save();
        }
    } catch (error) {
        console.error('❌ Error registrando sesión:', error);
    }
}

// Función para registrar el fin de sesión y calcular tiempo de juego
async function endPlayerSession(username) {
    try {
        const stats = await PlayerStats.findOne({ username });
        if (stats && stats.sessionStartTime) {
            const sessionDuration = Math.floor((Date.now() - stats.sessionStartTime.getTime()) / 60000); // en minutos
            stats.totalPlayTime += sessionDuration;
            stats.sessionStartTime = undefined;
            await stats.save();
            console.log(`⏱️ Sesión finalizada para ${username} - Duración: ${sessionDuration} minutos`);
        }
    } catch (error) {
        console.error('❌ Error finalizando sesión:', error);
    }
}

// Función para actualizar números favoritos (basado en los cartones del jugador)
async function updateFavoriteNumbers(username, cardIds) {
    try {
        const stats = await PlayerStats.findOne({ username });
        if (!stats) return;

        // Generar los números de los cartones y contar frecuencias
        const numberFrequency = new Map();
        
        for (const cardId of cardIds) {
            const card = generateCard(cardId); // Función existente en el server.js
            const allNumbers = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O].filter(n => n !== "FREE");
            
            allNumbers.forEach(num => {
                numberFrequency.set(num, (numberFrequency.get(num) || 0) + 1);
            });
        }

        // Obtener los 10 números más frecuentes
        const favoriteNumbers = Array.from(numberFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(entry => entry[0]);

        stats.favoriteNumbers = favoriteNumbers;
        await stats.save();
    } catch (error) {
        console.error('❌ Error actualizando números favoritos:', error);
    }
}

// 3. ENDPOINTS PARA EL CLIENTE

// Endpoint para obtener estadísticas del jugador
app.get('/player-stats/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const stats = await PlayerStats.findOne({ username });
        
        if (!stats) {
            return res.status(404).json({ 
                message: 'No hay estadísticas disponibles para este jugador',
                stats: null 
            });
        }
        
        // Calcular estadísticas adicionales
        const avgGameTime = stats.totalGames > 0 ? Math.round(stats.totalPlayTime / stats.totalGames) : 0;
        const lastGame = stats.gameHistory.length > 0 ? stats.gameHistory[stats.gameHistory.length - 1] : null;
        
        const statsWithExtras = {
            ...stats.toObject(),
            avgGameTime,
            lastGame,
            nextLevelProgress: ((stats.experience % 1000) / 1000) * 100
        };
        
        res.json(statsWithExtras);
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Endpoint para obtener estadísticas resumidas (para el dashboard)
app.get('/stats/summary', async (req, res) => {
    try {
        const totalPlayers = await PlayerStats.countDocuments();
        const activePlayers = await PlayerStats.countDocuments({ totalGames: { $gt: 0 } });
        const totalWins = await PlayerStats.aggregate([{ $group: { _id: null, total: { $sum: "$wins" } } }]);
        const avgWinRate = await PlayerStats.aggregate([{ $group: { _id: null, avg: { $avg: "$winRate" } } }]);
        
        res.json({
            totalPlayers,
            activePlayers,
            totalWins: totalWins[0]?.total || 0,
            avgWinRate: Math.round(avgWinRate[0]?.avg || 0),
            topPlayers: await PlayerStats.find().sort({ wins: -1 }).limit(10).select('username wins level')
        });
    } catch (error) {
        console.error('❌ Error obteniendo resumen de estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener resumen de estadísticas' });
    }
});

// 4. INTEGRACIÓN CON EL SISTEMA EXISTENTE

// Modificar la función checkForAutomaticWinners para registrar estadísticas
function checkForAutomaticWinners() {
    // ... lógica existente ...
    
    for (const player of allActivePlayers) {
        const { username, cardIds } = player;
        
        // ... lógica de detección de ganador ...
        
        if (checkWin(card, gameState.calledNumbers, gameState.pattern, gameState.customPattern)) {
            // Registrar la victoria
            const gameResult = {
                won: true,
                pattern: gameState.pattern,
                numbersCalled: gameState.calledNumbers.length,
                duration: calculateGameDuration() // Función que debes implementar
            };
            
            // Actualizar estadísticas
            updatePlayerStats(username, gameResult);
            
            // Actualizar números favoritos
            updateFavoriteNumbers(username, cardIds);
            
            // ... resto de la lógica existente ...
        }
    }
}

// 5. FUNCIONES DE APOYO

// Función para calcular duración del juego (necesita ser implementada según tu lógica)
function calculateGameDuration() {
    // Implementar según tu lógica de tiempo de juego
    return Math.floor(gameState.calledNumbers.length * 5 / 60); // Ejemplo: 5 segundos por número
}

// Función para obtener estadísticas de patrones (para análisis)
async function getPatternStats() {
    try {
        const patterns = await PlayerStats.aggregate([
            { $group: { 
                _id: null, 
                line: { $sum: "$patternsWon.line" },
                full: { $sum: "$patternsWon.full" },
                corners: { $sum: "$patternsWon.corners" },
                // ... otros patrones
            }}
        ]);
        return patterns[0] || {};
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de patrones:', error);
        return {};
    }
}

// 6. EXPORTAR FUNCIONES PARA USO EN OTROS MÓDULOS
module.exports = {
    PlayerStats,
    updatePlayerStats,
    registerPlayerSession,
    endPlayerSession,
    updateFavoriteNumbers,
    getPatternStats
};

// 7. EJEMPLO DE USO EN EL CLIENTE (index.html)

/*
// Función para mostrar estadísticas del jugador
async function showPlayerStats() {
    try {
        const response = await fetch(`/player-stats/${playerSession.username}`);
        const stats = await response.json();
        
        if (stats.stats) {
            // Mostrar estadísticas en un modal
            renderStatsModal(stats.stats);
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Función para renderizar el modal de estadísticas
function renderStatsModal(stats) {
    const modal = document.getElementById('stats-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <h3>📊 Estadísticas de ${stats.username}</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Nivel</h4>
                    <div class="level-display">
                        <div class="level-bar">
                            <div class="level-fill" style="width: ${stats.nextLevelProgress}%"></div>
                        </div>
                        <span>${stats.level}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <h4>Victorias</h4>
                    <div class="stat-value">${stats.wins}</div>
                    <div class="stat-sub">de ${stats.totalGames} partidas</div>
                </div>
                <div class="stat-card">
                    <h4>Win Rate</h4>
                    <div class="stat-value win-rate">${stats.winRate}%</div>
                </div>
                <div class="stat-card">
                    <h4>Tiempo Jugado</h4>
                    <div class="stat-value">${Math.floor(stats.totalPlayTime / 60)}h ${stats.totalPlayTime % 60}m</div>
                </div>
            </div>
            <div class="patterns-stats">
                <h4>Patrones Ganados</h4>
                <div class="patterns-grid">
                    ${Object.entries(stats.patternsWon).map(([pattern, wins]) => 
                        wins > 0 ? `<div class="pattern-stat">${pattern}: ${wins}</div>` : ''
                    ).join('')}
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}
*/
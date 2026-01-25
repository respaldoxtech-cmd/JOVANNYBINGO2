/**
 * 🚀 BINGO RULES ENGINE - RADICAL RESTRUCTURING
 * Completely new implementation with 50 figure patterns and automatic win detection
 */

// 🎯 50 FIGURE PATTERNS CONFIGURATION
const BINGO_PATTERNS = {
    // Basic Patterns
    'line': {
        name: 'LÍNEA',
        description: 'Any complete horizontal, vertical, or diagonal line',
        positions: [
            [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
            [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
            [0,6,12,18,24], [4,8,12,16,20]
        ]
    },

    'full': {
        name: 'CARTÓN LLENO',
        description: 'Complete blackout - all numbers marked',
        positions: [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]]
    },

    // Geometric Shapes
    'corners': {
        name: '4 ESQUINAS',
        description: 'Four corners of the card',
        positions: [[0,4,20,24]]
    },

    'frame': {
        name: 'MARCO',
        description: 'Outer frame of the card',
        positions: [[0,1,2,3,4,9,14,19,24,23,22,21,20,15,10,5]]
    },

    'diamond': {
        name: 'DIAMANTE',
        description: 'Diamond shape',
        positions: [[2,6,10,14,18,22]]
    },

    // Letters
    'letter_x': {
        name: 'LETRA X',
        description: 'X shape',
        positions: [[0,6,12,18,24], [4,8,12,16,20]]
    },

    'letter_t': {
        name: 'LETRA T',
        description: 'T shape',
        positions: [[0,1,2,3,4,7,12,17]]
    },

    'letter_h': {
        name: 'LETRA H',
        description: 'H shape',
        positions: [[0,5,10,15,20,2,7,12,17,22,4,9,14,19,24]]
    },

    'letter_o': {
        name: 'LETRA O',
        description: 'O shape',
        positions: [[1,2,3,5,9,10,14,15,19,21,22,23]]
    },

    'letter_l': {
        name: 'LETRA L',
        description: 'L shape',
        positions: [[0,5,10,15,20,21,22,23,24]]
    },

    // Complex Patterns
    'cross': {
        name: 'CRUZ',
        description: 'Cross through center',
        positions: [[2,7,12,17,22]]
    },

    'plus': {
        name: 'PLUS',
        description: 'Plus sign',
        positions: [[7,11,12,13,17]]
    },

    'star': {
        name: 'ESTRELLA',
        description: 'Star shape',
        positions: [[2,6,8,10,12,14,16,18,7,11,13,17]]
    },

    'heart': {
        name: 'CORAZÓN',
        description: 'Heart shape',
        positions: [[1,3,6,7,8,9,11,12,13,16,18]]
    },

    'arrow': {
        name: 'FLECHA',
        description: 'Arrow pointing up',
        positions: [[2,7,10,11,12,13,14,17]]
    },

    // Additional Patterns to reach 50
    'zigzag': {
        name: 'ZIGZAG',
        description: 'Zigzag pattern',
        positions: [[0,2,4,6,8,10,12,14,16,18,20,22,24]]
    },

    'pyramid': {
        name: 'PIRÁMIDE',
        description: 'Pyramid shape',
        positions: [[2,6,7,8,10,11,12,13,14,16,17,18]]
    },

    'small_square': {
        name: 'CUADRADO PEQUEÑO',
        description: 'Small 2x2 square',
        positions: [[0,1,5,6]]
    },

    'inner_frame': {
        name: 'MARCO INTERIOR',
        description: 'Inner frame',
        positions: [[6,7,8,11,13,16,17,18]]
    },

    'corners_center': {
        name: 'ESQUINAS + CENTRO',
        description: 'Four corners plus center',
        positions: [[0,4,12,20,24]]
    },

    // Pattern 20
    'horizontal_1': {
        name: 'FILA 1',
        description: 'First horizontal row',
        positions: [[0,5,10,15,20]]
    },

    'horizontal_2': {
        name: 'FILA 2',
        description: 'Second horizontal row',
        positions: [[1,6,11,16,21]]
    },

    'horizontal_3': {
        name: 'FILA 3',
        description: 'Third horizontal row',
        positions: [[2,7,12,17,22]]
    },

    'horizontal_4': {
        name: 'FILA 4',
        description: 'Fourth horizontal row',
        positions: [[3,8,13,18,23]]
    },

    'horizontal_5': {
        name: 'FILA 5',
        description: 'Fifth horizontal row',
        positions: [[4,9,14,19,24]]
    },

    // Pattern 25
    'vertical_b': {
        name: 'COLUMNA B',
        description: 'B column',
        positions: [[0,1,2,3,4]]
    },

    'vertical_i': {
        name: 'COLUMNA I',
        description: 'I column',
        positions: [[5,6,7,8,9]]
    },

    'vertical_n': {
        name: 'COLUMNA N',
        description: 'N column',
        positions: [[10,11,12,13,14]]
    },

    'vertical_g': {
        name: 'COLUMNA G',
        description: 'G column',
        positions: [[15,16,17,18,19]]
    },

    'vertical_o': {
        name: 'COLUMNA O',
        description: 'O column',
        positions: [[20,21,22,23,24]]
    },

    // Pattern 30
    'diagonal_main': {
        name: 'DIAGONAL PRINCIPAL',
        description: 'Main diagonal',
        positions: [[0,6,12,18,24]]
    },

    'diagonal_secondary': {
        name: 'DIAGONAL SECUNDARIA',
        description: 'Secondary diagonal',
        positions: [[4,8,12,16,20]]
    },

    'perimeter': {
        name: 'PERÍMETRO',
        description: 'Complete perimeter',
        positions: [[0,1,2,3,4,9,14,19,24,23,22,21,20,15,10,5]]
    },

    'inner_perimeter': {
        name: 'PERÍMETRO INTERIOR',
        description: 'Inner perimeter',
        positions: [[6,7,8,11,13,16,17,18]]
    },

    'cross_center': {
        name: 'CRUZ CENTRAL',
        description: 'Cross through center',
        positions: [[7,11,12,13,17]]
    },

    // Pattern 35
    'letter_c': {
        name: 'LETRA C',
        description: 'C shape',
        positions: [[0,1,2,3,5,10,15,20,24,23,22,21]]
    },

    'letter_s': {
        name: 'LETRA S',
        description: 'S shape',
        positions: [[0,1,2,3,4,5,6,7,12,17,22,23,24]]
    },

    'letter_z': {
        name: 'LETRA Z',
        description: 'Z shape',
        positions: [[0,1,2,3,4,9,14,19,24,23,22,21,20]]
    },

    'letter_u': {
        name: 'LETRA U',
        description: 'U shape',
        positions: [[0,5,10,15,20,4,9,14,19,24,23,22,21,20]]
    },

    'letter_v': {
        name: 'LETRA V',
        description: 'V shape',
        positions: [[0,5,10,15,20,4,9,14,19,24,12]]
    },

    // Pattern 40
    'letter_w': {
        name: 'LETRA W',
        description: 'W shape',
        positions: [[0,5,10,15,20,4,9,14,19,24,12,7,2]]
    },

    'letter_m': {
        name: 'LETRA M',
        description: 'M shape',
        positions: [[0,5,10,15,20,4,9,14,19,24,12,7,2,1,6,11]]
    },

    'letter_n': {
        name: 'LETRA N',
        description: 'N shape',
        positions: [[0,5,10,15,20,4,9,14,19,24,12,7,2]]
    },

    'letter_p': {
        name: 'LETRA P',
        description: 'P shape',
        positions: [[0,5,10,15,20,1,6,11,16,21,2,7,12]]
    },

    'letter_e': {
        name: 'LETRA E',
        description: 'E shape',
        positions: [[0,1,2,3,4,5,10,15,20,6,11,16,21,7,12,17]]
    },

    // Pattern 45
    'letter_f': {
        name: 'LETRA F',
        description: 'F shape',
        positions: [[0,1,2,3,4,5,10,15,20,6,11,16,21]]
    },

    'letter_d': {
        name: 'LETRA D',
        description: 'D shape',
        positions: [[0,1,2,3,5,10,15,20,24,23,22,21,6,11,16,21]]
    },

    'letter_r': {
        name: 'LETRA R',
        description: 'R shape',
        positions: [[0,5,10,15,20,1,6,11,16,21,2,7,12,17,22]]
    },

    'letter_k': {
        name: 'LETRA K',
        description: 'K shape',
        positions: [[0,5,10,15,20,4,9,14,19,24,12,7,2,13,18,23]]
    },

    'letter_y': {
        name: 'LETRA Y',
        description: 'Y shape',
        positions: [[0,5,10,15,20,4,9,14,19,24,12,7,2,13,18,23,11,6,1]]
    }
};

// 🔍 PATTERN VALIDATION FUNCTION
function validatePattern(patternType, flatCard, calledNumbers) {
    const isMarked = (val) => val === "FREE" || calledNumbers.includes(val);

    // Get the pattern from configuration
    const pattern = BINGO_PATTERNS[patternType];
    if (!pattern) return false;

    // Check if any of the pattern lines is complete
    return pattern.positions.some(line => {
        return line.every(idx => isMarked(flatCard[idx]));
    });
}

// 🎯 AUTOMATIC WIN DETECTION
function checkWin(card, calledNumbers, patternType) {
    // Flatten the card: B, I, N, G, O columns
    const flatCard = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O];

    // Use the validation function
    return validatePattern(patternType, flatCard, calledNumbers);
}

// 🚀 WINNER TRIGGER SYSTEM
function checkForWinners(players, calledNumbers, patternType, io) {
    const winners = [];

    // Check each player's cards
    for (const player of players) {
        for (const card of player.cards) {
            if (checkWin(card, calledNumbers, patternType)) {
                winners.push({
                    username: player.username,
                    cardId: card.id,
                    pattern: patternType,
                    time: new Date()
                });

                // 🎵 TRIGGER WINNER EVENT IMMEDIATELY
                io.emit('winner_detected', {
                    username: player.username,
                    cardId: card.id,
                    pattern: patternType,
                    calledNumbers: calledNumbers,
                    timestamp: new Date().toISOString()
                });

                // 📢 ADMIN NOTIFICATION
                io.emit('admin_winner_alert', {
                    winner: player.username,
                    cardId: card.id,
                    pattern: BINGO_PATTERNS[patternType].name,
                    numbersCalled: calledNumbers.length
                });

                // 🎉 CELEBRATION EVENT
                io.emit('bingo_celebration', {
                    message: `¡BINGO! ${player.username} ha ganado con ${BINGO_PATTERNS[patternType].name}!`,
                    winner: player.username,
                    pattern: patternType
                });
            }
        }
    }

    return winners;
}

// 📊 PATTERN STATISTICS
function getPatternStats() {
    return {
        totalPatterns: Object.keys(BINGO_PATTERNS).length,
        patternNames: Object.keys(BINGO_PATTERNS),
        patternDetails: BINGO_PATTERNS
    };
}

// 🔧 UTILITY FUNCTIONS
function getPatternByName(name) {
    return BINGO_PATTERNS[name];
}

function listAllPatterns() {
    return Object.keys(BINGO_PATTERNS).map(patternName => ({
        name: patternName,
        displayName: BINGO_PATTERNS[patternName].name,
        description: BINGO_PATTERNS[patternName].description
    }));
}

// 📈 EXPORT THE ENGINE
module.exports = {
    BINGO_PATTERNS,
    validatePattern,
    checkWin,
    checkForWinners,
    getPatternStats,
    getPatternByName,
    listAllPatterns
};
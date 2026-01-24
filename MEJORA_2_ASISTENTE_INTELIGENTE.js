// MEJORA 2: ASISTENTE INTELIGENTE DE JUEGO
// =======================================

// Este archivo contiene la implementación completa del asistente inteligente
// que ayuda a los jugadores a mejorar su experiencia de juego.

// 1. SISTEMA DE DETECCIÓN DE PROXIMIDAD A LA VICTORIA

// Función para analizar la proximidad a la victoria para cualquier patrón
function analyzeWinProximity(card, calledNumbers, pattern, customPattern = null) {
    const flatCard = [...card.B, ...card.I, ...card.N, ...card.G, ...card.O];
    const isMarked = (val) => val === "FREE" || calledNumbers.includes(val);
    
    let missingNumbers = 0;
    let totalRequired = 0;
    let markedCount = 0;
    let potentialWins = [];
    
    // Lógica según el patrón
    switch (pattern) {
        case 'line':
        case 'line_horizontal':
        case 'line_vertical':
        case 'line_diagonal':
            // Para líneas, analizamos cada posible línea
            const lines = getWinningLines(pattern);
            lines.forEach((line, lineIndex) => {
                let lineMissing = 0;
                let lineTotal = 0;
                let lineMarked = 0;
                
                line.forEach(idx => {
                    lineTotal++;
                    if (isMarked(flatCard[idx])) {
                        lineMarked++;
                    } else {
                        lineMissing++;
                    }
                });
                
                if (lineMissing <= 3) { // Si faltan 3 o menos números, es una oportunidad
                    potentialWins.push({
                        type: 'line',
                        index: lineIndex,
                        missing: lineMissing,
                        total: lineTotal,
                        marked: lineMarked,
                        percentage: Math.round((lineMarked / lineTotal) * 100)
                    });
                }
            });
            break;
            
        case 'full':
            // Para cartón lleno, contar cuántos faltan
            flatCard.forEach(val => {
                totalRequired++;
                if (isMarked(val)) {
                    markedCount++;
                } else {
                    missingNumbers++;
                }
            });
            break;
            
        case 'corners':
        case 'x':
        case 'plus':
        case 'corners_center':
        case 'frame':
        case 'inner_frame':
        case 'letter_h':
        case 'letter_t':
        case 'small_square':
        case 'diamond':
        case 'star':
        case 'heart':
        case 'airplane':
        case 'arrow':
        case 'crazy':
        case 'pyramid':
        case 'cross':
            // Para patrones específicos, usar la lógica de validación
            const patternCells = getPatternCells(pattern);
            patternCells.forEach(idx => {
                totalRequired++;
                if (isMarked(flatCard[idx])) {
                    markedCount++;
                } else {
                    missingNumbers++;
                }
            });
            break;
            
        case 'custom':
            if (customPattern) {
                customPattern.forEach((isActive, idx) => {
                    if (isActive) {
                        totalRequired++;
                        if (isMarked(flatCard[idx])) {
                            markedCount++;
                        } else {
                            missingNumbers++;
                        }
                    }
                });
            }
            break;
    }
    
    return {
        missingNumbers: pattern === 'line' ? Math.min(...potentialWins.map(p => p.missing)) : missingNumbers,
        totalRequired: pattern === 'line' ? totalRequired : totalRequired,
        markedCount: pattern === 'line' ? Math.max(...potentialWins.map(p => p.marked)) : markedCount,
        percentage: pattern === 'line' ? Math.max(...potentialWins.map(p => p.percentage)) : Math.round((markedCount / totalRequired) * 100),
        potentialWins: potentialWins,
        isCloseToWin: (pattern === 'line' && potentialWins.some(p => p.missing <= 2)) || 
                      (pattern !== 'line' && missingNumbers <= 2 && missingNumbers > 0)
    };
}

// Función para obtener las líneas ganadoras según el patrón
function getWinningLines(pattern) {
    const lines = {
        'line_horizontal': [
            [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24]
        ],
        'line_vertical': [
            [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24]
        ],
        'line_diagonal': [
            [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
        ],
        'line': [
            // Todas las líneas posibles
            [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], // Horizontales
            [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24], // Verticales
            [0, 6, 12, 18, 24], [4, 8, 12, 16, 20] // Diagonales
        ]
    };
    
    return lines[pattern] || lines['line'];
}

// Función para obtener las celdas de un patrón específico
function getPatternCells(pattern) {
    const patterns = {
        'corners': [0, 4, 20, 24],
        'x': [0, 6, 12, 18, 24, 4, 8, 16, 20],
        'plus': [7, 11, 12, 13, 17],
        'corners_center': [0, 4, 12, 20, 24],
        'frame': [0,1,2,3,4,9,14,19,24,23,22,21,20,15,10,5],
        'inner_frame': [6,7,8,11,13,16,17,18],
        'letter_h': [0,5,10,15,20,2,7,12,17,22,4,9,14,19,24],
        'letter_t': [0,1,2,3,4,7,12,17],
        'small_square': [0,1,5,6],
        'diamond': [2,6,10,14,18,22],
        'star': [2,6,8,10,12,14,16,18,7,11,12,13,17],
        'heart': [1,3,6,7,8,9,11,12,13,16,18],
        'airplane': [1,3,5,7,9,11,13,15,17,19,21,23],
        'arrow': [2,7,10,11,12,13,14,17],
        'crazy': [0,2,4,6,8,10,12,14,16,18,20,22,24],
        'pyramid': [2,6,7,8,10,11,12,13,14,16,17,18],
        'cross': [2,7,11,12,13,17,22]
    };
    
    return patterns[pattern] || [];
}

// 2. SISTEMA DE ALERTAS INTELIGENTES

// Sistema de alertas en el cliente (para ser integrado en index.html)
function checkWinProximity() {
    if (!myCards || myCards.length === 0) return;
    
    const calledNumbers = getCurrentCalledNumbers();
    let closestCard = null;
    let bestProximity = null;
    let bestLine = null;
    
    myCards.forEach(card => {
        const proximity = analyzeWinProximity(card, calledNumbers, currentPattern, currentCustomPatternGrid);
        
        if (proximity.isCloseToWin) {
            if (!bestProximity || proximity.missingNumbers < bestProximity.missingNumbers) {
                bestProximity = proximity;
                closestCard = card;
                if (proximity.potentialWins.length > 0) {
                    bestLine = proximity.potentialWins.reduce((best, current) => 
                        current.missing < best.missing ? current : best
                    );
                }
            }
        }
    });
    
    if (bestProximity) {
        showProximityAlert(closestCard.id, bestProximity, bestLine);
    }
}

// Función para mostrar alertas de proximidad
function showProximityAlert(cardId, proximity, lineInfo) {
    const cardElement = document.getElementById(`card-visual-${cardId}`);
    if (!cardElement) return;
    
    // Efectos visuales
    cardElement.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.9)';
    cardElement.style.transform = 'scale(1.03)';
    cardElement.style.zIndex = '1000';
    
    // Sonido de alerta
    playAlertSound();
    
    // Mostrar mensaje flotante
    showFloatingMessage(`🚨 ¡CASI GANAS! Faltan ${proximity.missingNumbers} números`, 'warning');
    
    // Resaltar la línea más cercana a ganar (si es una línea)
    if (lineInfo && currentPattern.includes('line')) {
        highlightLineInCard(cardId, lineInfo);
    }
    
    // Temporizador para remover los efectos después de 5 segundos
    setTimeout(() => {
        cardElement.style.boxShadow = '';
        cardElement.style.transform = '';
        cardElement.style.zIndex = '';
    }, 5000);
}

// Función para resaltar una línea específica en el cartón
function highlightLineInCard(cardId, lineInfo) {
    const cardElement = document.getElementById(`card-visual-${cardId}`);
    if (!cardElement) return;
    
    // Obtener todas las celdas del cartón
    const cells = cardElement.querySelectorAll('.grid-cell');
    
    // Resaltar las celdas de la línea
    lineInfo.indexes.forEach((idx, position) => {
        const cell = cells[idx];
        if (cell) {
            cell.style.backgroundColor = '#ffd700';
            cell.style.color = '#000';
            cell.style.fontWeight = 'bold';
            cell.style.transform = 'scale(1.1)';
        }
    });
    
    // Temporizador para remover el resaltado
    setTimeout(() => {
        cells.forEach(cell => {
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.style.fontWeight = '';
            cell.style.transform = '';
        });
    }, 3000);
}

// 3. SISTEMA DE SUGERENCIAS INTELIGENTES

// Función para analizar qué cartones son mejores según el patrón actual
function analyzeCardPerformance(cards, calledNumbers, pattern) {
    const analysis = cards.map(card => {
        const proximity = analyzeWinProximity(card, calledNumbers, pattern);
        
        // Calcular puntuación de utilidad (0-100)
        let score = 0;
        
        if (pattern === 'line') {
            // Para líneas, priorizar cartones con líneas casi completas
            const bestLine = proximity.potentialWins.reduce((best, current) => 
                current.percentage > best.percentage ? current : best
            );
            score = bestLine.percentage;
        } else {
            // Para otros patrones, usar el porcentaje general
            score = proximity.percentage;
        }
        
        return {
            cardId: card.id,
            score: Math.round(score),
            proximity: proximity,
            recommendation: getCardRecommendation(card, proximity, pattern)
        };
    });
    
    // Ordenar por puntuación
    analysis.sort((a, b) => b.score - a.score);
    
    return analysis;
}

// Función para obtener recomendaciones específicas para cada cartón
function getCardRecommendation(card, proximity, pattern) {
    const recommendations = [];
    
    if (proximity.isCloseToWin) {
        recommendations.push('🔥 Este cartón está MUY CERCA de ganar');
    }
    
    if (proximity.percentage > 70) {
        recommendations.push('✅ Buen rendimiento, sigue marcando');
    } else if (proximity.percentage > 30) {
        recommendations.push('⚠️ Rendimiento moderado, necesita más números');
    } else {
        recommendations.push('❌ Este cartón necesita muchos números');
    }
    
    // Recomendaciones específicas según el patrón
    if (pattern === 'full' && proximity.missingNumbers > 15) {
        recommendations.push('💡 Considera cambiar de cartón');
    }
    
    if (pattern.includes('line') && proximity.potentialWins.length > 0) {
        recommendations.push('🎯 Enfócate en completar líneas específicas');
    }
    
    return recommendations;
}

// 4. SISTEMA DE PROBABILIDADES EN TIEMPO REAL

// Función para calcular probabilidades de victoria
function calculateWinProbabilities(cards, calledNumbers, pattern, remainingNumbers) {
    const probabilities = cards.map(card => {
        const proximity = analyzeWinProximity(card, calledNumbers, pattern);
        
        // Calcular probabilidad basada en números faltantes y números restantes
        let probability = 0;
        
        if (proximity.missingNumbers === 0) {
            probability = 100; // Ya ganó
        } else if (proximity.missingNumbers === 1) {
            probability = Math.min(90, (1 / remainingNumbers.length) * 100);
        } else if (proximity.missingNumbers === 2) {
            probability = Math.min(50, (2 / remainingNumbers.length) * 100);
        } else if (proximity.missingNumbers <= 5) {
            probability = Math.min(20, (5 / remainingNumbers.length) * 100);
        } else {
            probability = Math.min(5, (10 / remainingNumbers.length) * 100);
        }
        
        return {
            cardId: card.id,
            probability: Math.round(probability),
            missingNumbers: proximity.missingNumbers,
            status: getCardStatus(probability)
        };
    });
    
    return probabilities;
}

// Función para obtener el estado del cartón según la probabilidad
function getCardStatus(probability) {
    if (probability >= 90) return 'Ganador';
    if (probability >= 50) return 'Muy Probable';
    if (probability >= 20) return 'Posible';
    if (probability >= 5) return 'Poco Probable';
    return 'Improbable';
}

// 5. SISTEMA DE ESTRATEGIAS RECOMENDADAS

// Función para obtener estrategias según el patrón actual
function getStrategyRecommendations(pattern, calledNumbers, cards) {
    const recommendations = [];
    
    switch (pattern) {
        case 'line':
        case 'line_horizontal':
        case 'line_vertical':
        case 'line_diagonal':
            recommendations.push({
                title: 'Estrategia de Líneas',
                description: 'Enfócate en completar líneas específicas. Marca todos los números que te acerquen a una línea completa.',
                tips: [
                    'Prioriza líneas que ya tengan 3 o más números marcados',
                    'Evita dispersar tus marcas entre muchas líneas',
                    'Observa el tablero maestro para ver qué números salen con frecuencia'
                ]
            });
            break;
            
        case 'full':
            recommendations.push({
                title: 'Estrategia de Cartón Lleno',
                description: 'Necesitas marcar TODO el cartón. La paciencia es clave.',
                tips: [
                    'No te desesperes si tarda en salir tu número',
                    'Cada número cuenta, no dejes de marcar ninguno',
                    'Considera cambiar de cartón si llevas muchos números sin marcar'
                ]
            });
            break;
            
        case 'corners':
            recommendations.push({
                title: 'Estrategia de Esquinas',
                description: 'Solo necesitas marcar las 4 esquinas. Es un objetivo pequeño pero específico.',
                tips: [
                    'Enfócate solo en los números de las esquinas',
                    'No te distraigas con los números del centro',
                    'Las esquinas son números específicos: B1, B15, O1, O75'
                ]
            });
            break;
            
        default:
            recommendations.push({
                title: 'Estrategia General',
                description: 'Cada patrón tiene sus propias particularidades. Mantente atento a los números que te acercan a la victoria.',
                tips: [
                    'Siempre revisa qué números te faltan',
                    'No pierdas de vista el tablero maestro',
                    'Mantén tu concentración en el patrón actual'
                ]
            });
    }
    
    // Análisis de cartones específicos
    const cardAnalysis = analyzeCardPerformance(cards, calledNumbers, pattern);
    const bestCard = cardAnalysis[0];
    
    if (bestCard && bestCard.score > 60) {
        recommendations.push({
            title: 'Cartón Recomendado',
            description: `Tu cartón #${bestCard.cardId} tiene un rendimiento excelente (${bestCard.score}%)`,
            tips: bestCard.recommendation
        });
    }
    
    return recommendations;
}

// 6. FUNCIONES DE APOYO PARA EL CLIENTE

// Función para reproducir sonido de alerta
function playAlertSound() {
    // Usar el sistema de audio existente
    if (bingoAudio) {
        // Crear un sonido de alerta agudo
        const now = bingoAudio.audioContext.currentTime;
        
        // Nota aguda de alerta
        bingoAudio.createTone(880, 0.2, 'sine', 0.3); // A5
        setTimeout(() => bingoAudio.createTone(1046.5, 0.2, 'sine', 0.3), 200); // C6
        setTimeout(() => bingoAudio.createTone(1318.5, 0.3, 'sine', 0.3), 400); // E6
    }
}

// Función para mostrar mensaje flotante
function showFloatingMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.innerText = message;
    
    // Estilos CSS para el mensaje flotante
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
        font-weight: bold;
        font-size: 1.1rem;
    `;
    
    document.body.appendChild(messageDiv);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// 7. INTEGRACIÓN CON EL SISTEMA EXISTENTE

// Modificar la función checkAutomaticBingo para incluir análisis de proximidad
function checkAutomaticBingo() {
    if (!myCards || myCards.length === 0) return;

    const calledNumbers = getCurrentCalledNumbers();
    
    // Primero verificar si hay victoria
    for (let card of myCards) {
        if (checkCardWin(card, calledNumbers, currentPattern)) {
            console.log(`¡BINGO AUTOMÁTICO! Cartón ${card.id} completado con patrón ${currentPattern}`);
            socket.emit('bingo_shout');
            return;
        }
    }
    
    // Luego verificar proximidad a la victoria (cada 10 números llamados)
    if (calledNumbers.length % 10 === 0 || calledNumbers.length <= 20) {
        checkWinProximity();
    }
}

// 8. EXPORTAR FUNCIONES PARA USO EN EL CLIENTE
window.GameAssistant = {
    analyzeWinProximity,
    checkWinProximity,
    analyzeCardPerformance,
    calculateWinProbabilities,
    getStrategyRecommendations,
    showFloatingMessage
};

// 9. CSS ADICIONAL PARA EL ASISTENTE INTELIGENTE
/*
<style>
.floating-message {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #3b82f6;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
    font-weight: bold;
    font-size: 1.1rem;
}

.floating-message.warning {
    background: #f59e0b;
}

.floating-message.success {
    background: #10b981;
}

.floating-message.error {
    background: #ef4444;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

.card-proximity-indicator {
    position: absolute;
    top: -10px;
    right: -10px;
    background: #f59e0b;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: bold;
    display: none;
}

.card-recommended {
    border: 3px solid #10b981 !important;
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.5) !important;
}
</style>
*/
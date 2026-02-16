// Fixes for interface issues, automatic bingo, and thumbnail synchronization

// Function to fix interface display - separate name from data
function fixInterfaceDisplay() {
    // This would be called when receiving pattern updates
    socket.on('update_pattern', (patternData) => {
        // Only show the name in the text
        document.getElementById('pattern-name-display').innerText = patternData.name;

        // Hide technical numbers (those that ruin the experience)
        const debugElement = document.getElementById('pattern-debug-info');
        if (debugElement) debugElement.style.display = 'none';

        // Draw the visual thumbnail
        renderPatternThumbnail(patternData.grid);
    });
}

// Function to render pattern thumbnail with proper synchronization
function renderPatternThumbnail(patternGrid) {
    const container = document.getElementById('pattern-preview-container');
    if (!container) return;

    container.innerHTML = ''; // Clear previous

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'mini-cell';

        // If the index is in the pattern, paint it blue
        if (patternGrid.includes(i)) {
            cell.style.backgroundColor = '#007bff';
        }

        container.appendChild(cell);
    }
}

// Function to check automatic bingo
function checkAutoBingo(playerCard, drawnNumbers, activePatternCells) {
    // activePatternCells should be an array of indices [0, 4, 12, ...]
    return activePatternCells.every(index => {
        const num = playerCard[index];
        return drawnNumbers.includes(num) || index === 12; // Index 12 is the free center
    });
}

// Initialize fixes when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Interface fixes and automatic bingo initialized');

    // Apply fixes to existing elements if they exist
    const patternDisplay = document.getElementById('pattern-name-display');
    const debugInfo = document.getElementById('pattern-debug-info');

    if (patternDisplay && debugInfo) {
        // Hide debug info by default
        debugInfo.style.display = 'none';
    }
});

// Export functions for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fixInterfaceDisplay,
        renderPatternThumbnail,
        checkAutoBingo
    };
}
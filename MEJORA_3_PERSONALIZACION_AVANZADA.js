// MEJORA 3: PERSONALIZACIÓN AVANZADA
// ==================================

// Este archivo contiene la implementación completa del sistema de personalización
// avanzada para el Yovanny Bingo, permitiendo a los jugadores personalizar
// completamente su experiencia de juego.

// 1. ESQUEMA DE PREFERENCIAS DE USUARIO
const userPreferencesSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    theme: { 
        type: String, 
        default: 'dark',
        enum: ['dark', 'light', 'party', 'night', 'classic', 'neon', 'ocean', 'forest']
    },
    soundProfile: {
        type: String,
        default: 'balanced',
        enum: ['muted', 'balanced', 'loud', 'custom']
    },
    customSounds: {
        bingo: String, // URL o ID de sonido personalizado
        numberCall: String,
        playerJoin: String,
        alert: String
    },
    animations: {
        type: Boolean,
        default: true
    },
    cardLayout: {
        type: String,
        default: 'grid',
        enum: ['grid', 'list', 'compact', 'carousel']
    },
    fontSize: {
        type: String,
        default: 'medium',
        enum: ['small', 'medium', 'large', 'xlarge']
    },
    colorBlindMode: {
        type: Boolean,
        default: false
    },
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
    autoMark: {
        type: Boolean,
        default: true
    },
    showStats: {
        type: Boolean,
        default: true
    },
    language: {
        type: String,
        default: 'es',
        enum: ['es', 'en', 'fr', 'de', 'it', 'pt']
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

// 2. SISTEMA DE TEMAS AVANZADOS

// Definición de temas con colores específicos
const themes = {
    dark: {
        name: 'Oscuro Clásico',
        colors: {
            '--bg-primary': '#0f172a',
            '--bg-secondary': '#1e293b',
            '--bg-card': '#334155',
            '--text-primary': '#f8fafc',
            '--text-secondary': '#94a3b8',
            '--text-muted': '#64748b',
            '--accent': '#38bdf8',
            '--accent-hover': '#0ea5e9',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444',
            '--border': '#334155',
            '--shadow': 'rgba(0,0,0,0.3)'
        }
    },
    light: {
        name: 'Claro Clásico',
        colors: {
            '--bg-primary': '#ffffff',
            '--bg-secondary': '#f8fafc',
            '--bg-card': '#e2e8f0',
            '--text-primary': '#0f172a',
            '--text-secondary': '#475569',
            '--text-muted': '#64748b',
            '--accent': '#2563eb',
            '--accent-hover': '#1d4ed8',
            '--success': '#16a34a',
            '--warning': '#d97706',
            '--danger': '#dc2626',
            '--border': '#e2e8f0',
            '--shadow': 'rgba(0,0,0,0.1)'
        }
    },
    party: {
        name: 'Fiesta',
        colors: {
            '--bg-primary': '#0f172a',
            '--bg-secondary': '#1e1b4b',
            '--bg-card': '#3b0764',
            '--text-primary': '#f8fafc',
            '--text-secondary': '#e0e7ff',
            '--text-muted': '#cbd5e1',
            '--accent': '#f472b6',
            '--accent-hover': '#ec4899',
            '--success': '#84cc16',
            '--warning': '#f59e0b',
            '--danger': '#ef4444',
            '--border': '#4c1d95',
            '--shadow': 'rgba(168,85,247,0.3)'
        }
    },
    night: {
        name: 'Noche',
        colors: {
            '--bg-primary': '#0b1220',
            '--bg-secondary': '#111827',
            '--bg-card': '#1f2937',
            '--text-primary': '#e5e7eb',
            '--text-secondary': '#9ca3af',
            '--text-muted': '#6b7280',
            '--accent': '#06b6d4',
            '--accent-hover': '#0891b2',
            '--success': '#10b981',
            '--warning': '#f59e0b',
            '--danger': '#ef4444',
            '--border': '#374151',
            '--shadow': 'rgba(6,182,212,0.2)'
        }
    },
    neon: {
        name: 'Neón',
        colors: {
            '--bg-primary': '#000000',
            '--bg-secondary': '#0a0a0a',
            '--bg-card': '#1a1a1a',
            '--text-primary': '#ffffff',
            '--text-secondary': '#d1d5db',
            '--text-muted': '#9ca3af',
            '--accent': '#00ff88',
            '--accent-hover': '#00cc6a',
            '--success': '#00ff88',
            '--warning': '#ffaa00',
            '--danger': '#ff3366',
            '--border': '#333333',
            '--shadow': 'rgba(0,255,136,0.4)'
        }
    },
    ocean: {
        name: 'Océano',
        colors: {
            '--bg-primary': '#0f172a',
            '--bg-secondary': '#1e3a8a',
            '--bg-card': '#3b82f6',
            '--text-primary': '#ffffff',
            '--text-secondary': '#e0f2fe',
            '--text-muted': '#93c5fd',
            '--accent': '#06b6d4',
            '--accent-hover': '#0891b2',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444',
            '--border': '#2563eb',
            '--shadow': 'rgba(6,182,212,0.3)'
        }
    },
    forest: {
        name: 'Bosque',
        colors: {
            '--bg-primary': '#052e16',
            '--bg-secondary': '#064e3b',
            '--bg-card': '#0f766e',
            '--text-primary': '#f0fdf4',
            '--text-secondary': '#bbf7d0',
            '--text-muted': '#6ee7b7',
            '--accent': '#22c55e',
            '--accent-hover': '#16a34a',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444',
            '--border': '#14532d',
            '--shadow': 'rgba(34,197,94,0.3)'
        }
    }
};

// 3. FUNCIONES DE GESTIÓN DE PREFERENCIAS

// Función para obtener o crear preferencias del usuario
async function getUserPreferences(username) {
    try {
        let preferences = await UserPreferences.findOne({ username });
        
        if (!preferences) {
            // Crear preferencias por defecto
            preferences = new UserPreferences({ username });
            await preferences.save();
        }
        
        return preferences;
    } catch (error) {
        console.error('Error obteniendo preferencias:', error);
        return null;
    }
}

// Función para actualizar preferencias del usuario
async function updateUserPreferences(username, updates) {
    try {
        const preferences = await UserPreferences.findOneAndUpdate(
            { username },
            { ...updates, updatedAt: new Date() },
            { new: true, upsert: true }
        );
        
        // Aplicar cambios en tiempo real si el usuario está conectado
        const socket = getSocketByUser(username);
        if (socket) {
            socket.emit('preferences_updated', preferences);
        }
        
        return preferences;
    } catch (error) {
        console.error('Error actualizando preferencias:', error);
        throw error;
    }
}

// 4. SISTEMA DE SONIDOS PERSONALIZADOS

// Definición de perfiles de sonido
const soundProfiles = {
    muted: {
        volume: 0,
        effects: false,
        music: false
    },
    balanced: {
        volume: 0.5,
        effects: true,
        music: false
    },
    loud: {
        volume: 1.0,
        effects: true,
        music: true
    }
};

// Sistema de sonidos personalizados
class CustomAudioSystem {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.profile = 'balanced';
        this.init();
    }
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.loadSoundProfile(this.profile);
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    loadSoundProfile(profile) {
        this.profile = profile;
        const settings = soundProfiles[profile] || soundProfiles.balanced;
        
        // Aplicar volumen general
        if (this.audioContext) {
            this.audioContext.destination.gain.value = settings.volume;
        }
        
        // Cargar sonidos según el perfil
        this.loadSounds(settings);
    }
    
    loadSounds(settings) {
        // Sonidos básicos (se pueden sobrescribir con personalizados)
        const basicSounds = {
            bingo: this.createBingoSound.bind(this),
            numberCall: this.createNumberCallSound.bind(this),
            playerJoin: this.createPlayerJoinSound.bind(this),
            alert: this.createAlertSound.bind(this)
        };
        
        // Si hay sonidos personalizados, cargarlos
        // Esto requeriría almacenar URLs de sonidos en la base de datos
        
        this.sounds = basicSounds;
    }
    
    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }
    
    // Sonidos básicos mejorados
    createBingoSound() {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const gain = this.audioContext.createGain();
        gain.connect(this.audioContext.destination);
        
        // Melodía de victoria
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        
        notes.forEach((freq, index) => {
            setTimeout(() => {
                const osc = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                osc.connect(gainNode);
                gainNode.connect(gain);
                
                osc.frequency.setValueAtTime(freq, now + index * 0.2);
                osc.type = 'triangle';
                
                gainNode.gain.setValueAtTime(0, now + index * 0.2);
                gainNode.gain.linearRampToValueAtTime(0.3, now + index * 0.2 + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + index * 0.2 + 0.3);
                
                osc.start(now + index * 0.2);
                osc.stop(now + index * 0.2 + 0.3);
            }, index * 200);
        });
    }
    
    createNumberCallSound() {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.frequency.setValueAtTime(600, now);
        osc.type = 'sawtooth';
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        osc.start(now);
        osc.stop(now + 0.2);
    }
    
    createPlayerJoinSound() {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.frequency.setValueAtTime(440, now);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.start(now);
        osc.stop(now + 0.15);
    }
    
    createAlertSound() {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        
        // Sonido agudo de alerta
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.frequency.setValueAtTime(880, now);
        osc.type = 'square';
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

// 5. SISTEMA DE DISEÑO DE CARTONES

// Funciones para cambiar el layout de los cartones
function applyCardLayout(layout) {
    const container = document.getElementById('cards-container');
    
    switch (layout) {
        case 'grid':
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
            container.style.gap = '20px';
            break;
            
        case 'list':
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '15px';
            break;
            
        case 'compact':
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
            container.style.gap = '10px';
            break;
            
        case 'carousel':
            container.style.display = 'block';
            // Implementar carrusel con JavaScript
            initCarousel(container);
            break;
    }
}

// 6. SISTEMA DE ACCESIBILIDAD AVANZADA

// Funciones para modos de accesibilidad
function applyAccessibilitySettings(settings) {
    const body = document.body;
    
    // Alto contraste
    if (settings.highContrast) {
        body.classList.add('high-contrast');
    } else {
        body.classList.remove('high-contrast');
    }
    
    // Lector de pantalla
    if (settings.screenReader) {
        enableScreenReaderMode();
    } else {
        disableScreenReaderMode();
    }
    
    // Atajos de teclado
    if (settings.keyboardShortcuts) {
        setupKeyboardShortcuts();
    } else {
        removeKeyboardShortcuts();
    }
}

// 7. SISTEMA DE IDIOMAS

// Definición de textos en diferentes idiomas
const translations = {
    es: {
        'BINGO': 'BINGO',
        'Player': 'Jugador',
        'Cards': 'Cartones',
        'Pattern': 'Patrón',
        'Win Rate': 'Tasa de Victorias',
        'Total Games': 'Partidas Totales',
        'Close to Win': 'Cerca de Ganar',
        'Settings': 'Configuración',
        'Theme': 'Tema',
        'Sounds': 'Sonidos',
        'Accessibility': 'Accesibilidad',
        'Language': 'Idioma'
    },
    en: {
        'BINGO': 'BINGO',
        'Player': 'Player',
        'Cards': 'Cards',
        'Pattern': 'Pattern',
        'Win Rate': 'Win Rate',
        'Total Games': 'Total Games',
        'Close to Win': 'Close to Win',
        'Settings': 'Settings',
        'Theme': 'Theme',
        'Sounds': 'Sounds',
        'Accessibility': 'Accessibility',
        'Language': 'Language'
    },
    fr: {
        'BINGO': 'BINGO',
        'Player': 'Joueur',
        'Cards': 'Cartes',
        'Pattern': 'Motif',
        'Win Rate': 'Taux de Victoires',
        'Total Games': 'Parties Totales',
        'Close to Win': 'Proche de Gagner',
        'Settings': 'Paramètres',
        'Theme': 'Thème',
        'Sounds': 'Sons',
        'Accessibility': 'Accessibilité',
        'Language': 'Langue'
    }
};

// Función para cambiar el idioma
function changeLanguage(language) {
    const currentTranslations = translations[language] || translations.es;
    
    // Cambiar todos los textos en el DOM
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (currentTranslations[key]) {
            element.innerText = currentTranslations[key];
        }
    });
    
    // Guardar preferencia
    localStorage.setItem('yovanny_language', language);
}

// 8. ENDPOINTS PARA EL CLIENTE

// Endpoint para obtener preferencias del usuario
app.get('/user-preferences/:username', async (req, res) => {
    try {
        const preferences = await getUserPreferences(req.params.username);
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo preferencias' });
    }
});

// Endpoint para actualizar preferencias
app.post('/user-preferences/:username', async (req, res) => {
    try {
        const preferences = await updateUserPreferences(req.params.username, req.body);
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando preferencias' });
    }
});

// 9. INTEGRACIÓN CON EL CLIENTE

// Función para aplicar todas las preferencias al cargar
async function applyUserPreferences(username) {
    const preferences = await getUserPreferences(username);
    
    if (preferences) {
        // Aplicar tema
        applyTheme(preferences.theme);
        
        // Aplicar perfil de sonido
        if (window.bingoAudio) {
            window.bingoAudio.loadSoundProfile(preferences.soundProfile);
        }
        
        // Aplicar layout de cartones
        applyCardLayout(preferences.cardLayout);
        
        // Aplicar tamaño de fuente
        applyFontSize(preferences.fontSize);
        
        // Aplicar modo de daltonismo
        if (preferences.colorBlindMode) {
            applyColorBlindMode();
        }
        
        // Aplicar accesibilidad
        applyAccessibilitySettings({
            highContrast: preferences.accessibility.highContrast,
            screenReader: preferences.accessibility.screenReader,
            keyboardShortcuts: preferences.accessibility.keyboardShortcuts
        });
        
        // Aplicar idioma
        changeLanguage(preferences.language);
        
        // Configurar notificaciones
        setupNotifications(preferences.notifications);
    }
}

// 10. FUNCIONES DE APOYO

// Función para aplicar tema
function applyTheme(themeName) {
    const theme = themes[themeName] || themes.dark;
    const root = document.documentElement;
    
    Object.entries(theme.colors).forEach(([cssVar, color]) => {
        root.style.setProperty(cssVar, color);
    });
    
    // Guardar tema
    localStorage.setItem('yovanny_theme', themeName);
}

// Función para aplicar tamaño de fuente
function applyFontSize(size) {
    const sizes = {
        small: '0.8rem',
        medium: '1rem',
        large: '1.2rem',
        xlarge: '1.4rem'
    };
    
    document.body.style.fontSize = sizes[size] || sizes.medium;
}

// Función para modo de daltonismo
function applyColorBlindMode() {
    document.body.classList.add('color-blind-mode');
}

// 11. EXPORTAR FUNCIONES
module.exports = {
    UserPreferences,
    getUserPreferences,
    updateUserPreferences,
    CustomAudioSystem,
    applyUserPreferences,
    applyTheme,
    changeLanguage
};

// 12. CSS ADICIONAL PARA LA PERSONALIZACIÓN
/*
<style>
/* Alto contraste */
.high-contrast {
    filter: contrast(1.5) brightness(1.2);
}

.high-contrast .bingo-card {
    border: 3px solid #ffffff !important;
    background: #000000 !important;
    color: #ffffff !important;
}

/* Modo daltonismo */
.color-blind-mode .grid-cell.marked {
    background: #ff0000 !important; /* Rojo para todos los marcados */
}

.color-blind-mode .grid-cell.free {
    background: #ffff00 !important; /* Amarillo para FREE */
}

/* Animaciones configurables */
.enable-animations * {
    transition: all 0.3s ease;
}

.disable-animations * {
    transition: none !important;
}

/* Layouts de cartones */
.card-layout-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
}

.card-layout-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.card-layout-compact {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
}

/* Fuentes */
.font-size-small { font-size: 0.8rem; }
.font-size-medium { font-size: 1rem; }
.font-size-large { font-size: 1.2rem; }
.font-size-xlarge { font-size: 1.4rem; }

/* Temas específicos */
.theme-party {
    background: linear-gradient(45deg, #0f172a, #1e1b4b);
    animation: themeParty 10s infinite alternate;
}

@keyframes themeParty {
    0% { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(360deg); }
}

.theme-neon {
    text-shadow: 0 0 10px var(--accent);
    box-shadow: 0 0 20px var(--accent);
}

.theme-ocean {
    background: linear-gradient(135deg, #0f172a, #1e3a8a);
    border-left: 4px solid var(--accent);
}

.theme-forest {
    background: linear-gradient(135deg, #052e16, #064e3b);
    border-left: 4px solid var(--success);
}
</style>
*/

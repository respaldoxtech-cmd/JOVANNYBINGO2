# Yovanny Bingo - Sistema de Bingo en Tiempo Real

## 🎯 Descripción
Sistema de bingo en tiempo real con administración avanzada, soporte para múltiples patrones de juego y gestión de jugadores con MongoDB Atlas.

## 🚀 Características Principales

### ✅ **Juego en Tiempo Real**
- Números llamados en tiempo real
- Verificación automática de ganadores
- 25+ patrones de juego diferentes
- Soporte para cartones personalizados

### ✅ **Administración Avanzada**
- Panel de control para administradores
- Gestión de jugadores en tiempo real
- Sistema de aprobación de jugadores
- Agregación manual de jugadores sin verificación
- Visualización de disponibilidad de cartones

### ✅ **Persistencia de Datos**
- MongoDB Atlas para datos persistentes
- Cartones únicos (1-300)
- Historial de ganadores
- Estado del juego persistente

### ✅ **Experiencia de Usuario**
- Interfaz responsive para móviles
- Modo administrador tipo broadcast TV
- Notificaciones en tiempo real
- Sistema de re-conexión automática

## 📋 Requisitos del Sistema

- Node.js 14.0.0 o superior
- MongoDB Atlas (cuenta gratuita)
- Acceso a internet para dependencias

## 🔧 Instalación

1. **Clonar el repositorio:**
```bash
git clone <tu-repositorio>
cd yovanny-bingo
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno:**
Crear un archivo `.env` en la raíz del proyecto:
```env
MONGO_URI=mongodb+srv://bin:123456a@cluster0.r9kcena.mongodb.net/?appName=Cluster0
PORT=3000
```

4. **Iniciar el servidor:**
```bash
npm start
```

## 🌐 Despliegue en Render

### 1. **Configurar Variables de Entorno en Render**
```
MONGO_URI=mongodb+srv://bin:123456a@cluster0.r9kcena.mongodb.net/?appName=Cluster0
PORT=10000
```

### 2. **Comandos de Inicio**
```bash
npm start
```

### 3. **Verificar Conexión**
En los logs de Render deberías ver:
```
🔗 Intentando conectar a MongoDB Atlas...
📍 URI: mongodb://***:***@cluster0.mongodb.net
✅ Conexión exitosa a MongoDB Atlas: cluster0-shard-00-00.mongodb.net
📊 Base de datos: yovanny_bingo
🔗 Estado: Conectado
🔄 Inicializando cartones ocupados desde MongoDB...
✅ Cartones ocupados inicializados: 0 cartones
Yovanny Bingo V12 (Unique Cards) en puerto 10000
```

## 🎮 Patrones de Juego Disponibles

### **Patrones Automáticos:**
- **Línea**: Cualquier línea completa (filas, columnas o diagonales)
- **Lleno**: Cartón completo
- **4 Esquinas**: Las 4 esquinas del cartón
- **X**: Ambas diagonales
- **Plus**: Forma de cruz (+)
- **Marco**: Marco exterior del cartón
- **Letra H**: Forma de la letra H
- **Letra T**: Forma de la letra T
- **Y más...**: 25+ patrones diferentes

### **Patrón Personalizado:**
- Dibujo libre en cuadrícula 5x5
- Configuración visual en el panel de administración

## 👥 Gestión de Jugadores

### **Sistema de Aprobación**
1. Jugador solicita unirse con cartones
2. Admin recibe notificación de jugador pendiente
3. Admin aprueba o rechaza la solicitud
4. Jugador recibe sus cartones generados

### **Agregación Manual (Sin Verificación)**
- Admin puede agregar jugadores directamente
- Asignación instantánea de cartones
- Persistencia en base de datos
- Sin necesidad de verificación

### **Tipos de Jugadores**
- **Conectados**: Jugadores activos en línea
- **Virtuales**: Jugadores agregados manualmente por admin
- **Desconectados**: Mantienen sus cartones asignados

## 🎲 Sistema de Cartones

### **Características**
- **300 cartones únicos** numerados del 1 al 300
- **Validación de duplicados** en tiempo real
- **Disponibilidad en tiempo real** en el panel de admin
- **Persistencia** entre reinicios del servidor

### **Validación de Cartones**
- Rango válido: 1-300
- No duplicados por jugador
- No duplicados entre jugadores
- Disponibilidad verificada en base de datos

## 📊 Panel de Administración

### **Funciones Principales**
- **Llamado de números**: Manual o automático
- **Gestión de patrones**: Selección y personalización
- **Control de jugadores**: Aprobación, expulsión, agregación
- **Monitorización**: Estado de cartones, historial de ganadores
- **Mensajes**: Mensajes personalizados en tiempo real

### **Vista de Disponibilidad de Cartones**
- Cuadrícula de 300 cartones
- Estado en tiempo real (disponible/ocupado)
- Selección visual para agregación manual
- Conteo de cartones disponibles/ocupados

## 🔧 Configuración Avanzada

### **Variables de Entorno**
```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
PORT=3000
ADMIN_PASS=admin123  # Opcional: cambiar contraseña de admin
```

### **Optimización de Memoria**
El sistema incluye configuración automática de heap size:
```json
"start": "node --max-old-space-size=450 server.js"
```

### **Conexión a MongoDB Atlas**
1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crear cluster gratuito
3. Configurar IP allowlist (0.0.0.0/0 para desarrollo)
4. Crear usuario y contraseña
5. Obtener la cadena de conexión

## 🐛 Solución de Problemas

### **Problemas Comunes**

#### **Conexión a MongoDB**
- Verificar que `MONGO_URI` sea correcta
- Asegurar que la IP esté en la allowlist de Atlas
- Verificar credenciales de usuario

#### **Cartones Duplicados**
- El sistema previene duplicados automáticamente
- Verificar que no haya inconsistencias en la base de datos
- Usar "Reiniciar Todo" para limpiar estado

#### **Problemas de Conexión**
- Verificar que el puerto esté disponible
- Revisar logs del servidor
- Verificar firewall y configuración de red

### **Logs Importantes**
```
✅ Conexión exitosa a MongoDB Atlas
🔄 Inicializando cartones ocupados desde MongoDB
🎯 Número llamado: 42
🏆 GANADOR AUTOMÁTICO: Juan con cartón #123
```

## 📁 Estructura del Proyecto

```
├── server.js          # Servidor principal con Socket.IO
├── public/            # Archivos estáticos
│   ├── index.html     # Interfaz de jugador
│   ├── admin.html     # Panel de administración
│   ├── style.css      # Estilos CSS
│   └── script.js      # Lógica del cliente
├── .env              # Variables de entorno
├── package.json      # Dependencias y scripts
└── README.md         # Documentación
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcion`)
3. Haz commit de tus cambios (`git commit -m 'Añadir nueva función'`)
4. Sube a la rama (`git push origin feature/nueva-funcion`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- MongoDB Atlas por la base de datos en la nube
- Socket.IO por la comunicación en tiempo real
- Express.js por el framework web
- Comunidad open source por las dependencias utilizadas

---

**¡Listo para jugar!** 🎯🎉
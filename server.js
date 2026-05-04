const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const transitData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'transit_data.json'),
    'utf8'
  )
);

app.get('/', (req, res) => {
  res.send('SafeRoute API funcionando');
});

app.get('/routes', (req, res) => {
  res.json(transitData.routes || transitData);
});

app.get('/stops/waiting', (req, res) => {
  res.json([]);
});

// --- STUBS: Endpoints simulados para evitar 404 en el Frontend ---

// 1. Registro de vista (Admin)
app.post('/admin/track-view', (req, res) => {
  res.json({ success: true });
});

// 2. Registro de espera en parada (Social)
app.post('/stops/waiting', (req, res) => {
  res.json({ success: true, message: 'Espera registrada simulada' });
});

// 3. Zonas de seguridad (Safety)
app.get('/stops/safety', (req, res) => {
  res.json([]); // Array vacío para no fallar
});

// 4. Compartir viaje (Trips)
app.post('/trips/share', (req, res) => {
  res.json({ 
    shareUrl: 'https://proyecto-paramilitar.onrender.com/viaje.html', 
    token: 'dummy-token-123' 
  });
});

// 5. Borrar viaje (Trips)
app.delete('/trips/:token', (req, res) => {
  res.json({ success: true });
});

// 6. Consultar viaje (Trips / viaje.html)
app.get('/trips/:token', (req, res) => {
  res.json({ expired: true }); // Simula que el viaje ya expiró
});

// 7. Exportar reportes (Admin)
app.get('/admin/export/:type', (req, res) => {
  res.status(401).json({ error: 'Funcionalidad de exportación deshabilitada en versión mínima' });
});
// ----------------------------------------------------------------

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Cliente conectado');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

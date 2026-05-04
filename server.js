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

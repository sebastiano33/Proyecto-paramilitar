const state = require('../store/state');

const getDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180, dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const sumarPuntos = (userId, socketId, pts, io, lat, lon) => {
    if (!state.usuarios[userId]) {
        state.usuarios[userId] = { nickname: `Pasajero #${userId.slice(-4)}`, puntos: 0, reportes: [], validaciones: 0 };
    }
    state.usuarios[userId].puntos += pts;
    if (io) {
        io.emit('puntos-update', { userId, puntos: state.usuarios[userId].puntos });
    }
};

module.exports = { getDist, sumarPuntos };

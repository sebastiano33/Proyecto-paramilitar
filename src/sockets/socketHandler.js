const BusService = require('../services/BusService');
const TransitService = require('../services/TransitService');
const SocialService = require('../services/SocialService');

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] Cliente conectado: ${socket.id}`);

        // --- Eventos de Transporte ---
        socket.on('bus_location_update', (data) => {
            const updatedBus = BusService.updateLocation(data.busId, data);
            io.emit('bus_update', updatedBus);
        });

        socket.on('user_waiting', (data) => {
            const update = TransitService.registerWaiting(data.stopName);
            io.emit('stop_updated', update);
        });

        // --- Eventos de Red Social ---
        socket.on('new_post', (data) => {
            const post = SocialService.createPost(data);
            io.emit('social_new_post', post);
        });

        socket.on('new_comment', (data) => {
            const comment = SocialService.addComment(data.postId, data);
            if (comment) io.emit('social_new_comment', { postId: data.postId, comment });
        });

        socket.on('add_reaction', (data) => {
            const reactions = SocialService.addReaction(data.postId, data.type);
            if (reactions) io.emit('social_reaction_update', { postId: data.postId, reactions });
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Cliente desconectado: ${socket.id}`);
        });
    });
};

module.exports = socketHandler;

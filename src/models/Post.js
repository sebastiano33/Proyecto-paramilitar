const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    nickname: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nickname: String,
    type: { type: String, default: 'Publicación' },
    message: { type: String, required: true },
    routeId: String,
    stopName: String,
    reactions: {
        useful: { type: Number, default: 0 },
        arrived: { type: Number, default: 0 },
        alert: { type: Number, default: 0 },
        thanks: { type: Number, default: 0 }
    },
    comments: [commentSchema],
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);

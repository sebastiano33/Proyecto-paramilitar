const express = require('express');
const router = express.Router();
const socialService = require('../services/SocialService');
const userRepository = require('../repositories/userRepository');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

router.get('/feed', optionalAuth, catchAsync(async (req, res) => {
    const posts = socialService.getFeed(req.query);
    
    // Enriquecer con autores
    const enriched = await Promise.all(posts.map(async p => {
        const author = await userRepository.findById(p.authorId);
        return {
            ...p,
            author: author ? {
                username: author.username,
                displayName: author.displayName,
                avatar: author.avatar,
                reputationScore: author.reputationScore,
                role: author.role
            } : null
        };
    }));

    res.json(enriched);
}));

router.post('/posts', authenticateToken, catchAsync(async (req, res) => {
    const post = await socialService.createPost(req.body, req.user.id);
    res.status(201).json({ success: true, post });
}));

router.post('/posts/:postId/react', authenticateToken, catchAsync(async (req, res) => {
    const reactions = await socialService.reactToPost(req.params.postId, req.user.id, req.body.reaction);
    res.json({ success: true, reactions });
}));

router.get('/trending', optionalAuth, catchAsync(async (req, res) => {
    // Mock de tendencias basado en paradas populares
    const trends = {
        stops: [
            ['Portal Transcaribe', Math.floor(Math.random() * 50)],
            ['Bazurto', Math.floor(Math.random() * 40)],
            ['Centro Histórico', Math.floor(Math.random() * 30)]
        ]
    };
    res.json(trends);
}));

module.exports = router;

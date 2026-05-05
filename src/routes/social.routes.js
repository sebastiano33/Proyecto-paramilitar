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

    res.json({ success: true, posts: enriched });
}));

router.post('/posts', authenticateToken, catchAsync(async (req, res) => {
    const post = await socialService.createPost(req.body, req.user.id);
    res.status(201).json({ success: true, post });
}));

router.post('/posts/:postId/react', authenticateToken, catchAsync(async (req, res) => {
    const reactions = await socialService.reactToPost(req.params.postId, req.user.id, req.body.reaction);
    res.json({ success: true, reactions });
}));

module.exports = router;

const express = require('express');
const router = express.Router();
const userRepository = require('../repositories/userRepository');
const reputationService = require('../services/ReputationService');
const catchAsync = require('../utils/catchAsync');

router.get('/:userId/profile', catchAsync(async (req, res) => {
    const { userId } = req.params;
    const user = await userRepository.findById(userId);
    
    if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const stats = await reputationService.getStats(userId);
    const currentLevel = reputationService.getLevel(user.reputationScore);

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            bio: user.bio,
            reputationScore: user.reputationScore,
            reputationLevel: currentLevel,
            badges: user.badges || []
        },
        stats
    });
}));

module.exports = router;

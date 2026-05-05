const express = require('express');
const router = express.Router();
const analytics = require('../services/userAnalytics');
const { authenticateToken } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

router.get('/me/analytics', authenticateToken, catchAsync(async (req, res) => {
    const stats = await analytics.getStats(req.user.id);
    res.json({ success: true, ...stats, generatedAt: new Date() });
}));

module.exports = router;

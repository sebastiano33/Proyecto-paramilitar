const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

router.post('/track-view', adminController.trackView);
router.get('/export/:type', adminController.exportReport);

module.exports = router;

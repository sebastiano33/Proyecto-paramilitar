const express = require('express');
const router = express.Router();
const socialController = require('../controllers/social.controller');

router.get('/feed', socialController.getFeed);
router.post('/post', socialController.createPost);
router.post('/comment', socialController.addComment);
router.post('/react', socialController.addReaction);
router.get('/trending', socialController.getTrending);

module.exports = router;

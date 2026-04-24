const express = require('express');
const router = express.Router();
const controller = require('../controllers/anuncios.controller');

router.get('/', controller.getAnuncios);
router.post('/', controller.publicarAnuncio);

module.exports = router;

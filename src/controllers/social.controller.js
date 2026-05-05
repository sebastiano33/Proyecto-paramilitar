const SocialService = require('../services/SocialService');

exports.getFeed = async (req, res) => {
    try {
        const feed = await SocialService.getFeed();
        res.json(feed);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar feed' });
    }
};

exports.createPost = async (req, res) => {
    try {
        const postData = {
            ...req.body,
            userId: req.user.id,
            nickname: req.user.nickname
        };
        const post = await SocialService.createPost(postData);
        res.status(201).json(post);
    } catch (err) {
        res.status(400).json({ error: 'Error al crear publicación' });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { postId } = req.body;
        const commentData = {
            ...req.body,
            nickname: req.user.nickname
        };
        const comment = await SocialService.addComment(postId, commentData);
        if (!comment) return res.status(404).json({ error: 'Post no encontrado' });
        res.json(comment);
    } catch (err) {
        res.status(400).json({ error: 'Error al comentar' });
    }
};

exports.addReaction = async (req, res) => {
    try {
        const { postId, type } = req.body;
        const reactions = await SocialService.addReaction(postId, type);
        if (!reactions) return res.status(404).json({ error: 'No se pudo reaccionar' });
        res.json(reactions);
    } catch (err) {
        res.status(400).json({ error: 'Error en reacción' });
    }
};

exports.getTrending = async (req, res) => {
    try {
        const trending = await SocialService.getTrending();
        res.json(trending);
    } catch (err) {
        res.status(500).json({ error: 'Error en tendencias' });
    }
};

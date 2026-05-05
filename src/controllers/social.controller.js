const SocialService = require('../services/SocialService');

exports.getFeed = (req, res) => {
    res.json(SocialService.getFeed());
};

exports.createPost = (req, res) => {
    const post = SocialService.createPost(req.body);
    // Nota: El socket emit se hará desde el socketHandler o aquí si se inyecta io
    res.json(post);
};

exports.addComment = (req, res) => {
    const { postId } = req.body;
    const comment = SocialService.addComment(postId, req.body);
    if (!comment) return res.status(404).json({ error: 'Post no encontrado' });
    res.json(comment);
};

exports.addReaction = (req, res) => {
    const { postId, type } = req.body;
    const reactions = SocialService.addReaction(postId, type);
    if (!reactions) return res.status(404).json({ error: 'Post o tipo de reacción inválido' });
    res.json(reactions);
};

exports.getTrending = (req, res) => {
    res.json(SocialService.getTrending());
};

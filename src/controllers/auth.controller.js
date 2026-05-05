const UserService = require('../services/UserService');

exports.register = async (req, res) => {
    try {
        const result = await UserService.register(req.body);
        if (result.error) return res.status(400).json(result);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await UserService.login(email, password);
        if (result.error) return res.status(401).json(result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

exports.getMe = (req, res) => {
    const user = UserService.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
};

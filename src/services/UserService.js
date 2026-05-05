const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = 'saferoute-super-secret-key-2026';

class UserService {
    async register(data) {
        const existing = await User.findOne({ email: data.email });
        if (existing) return { error: 'El usuario ya existe' };

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = await User.create({
            nickname: data.nickname,
            email: data.email,
            password: hashedPassword,
            avatar: data.nickname[0].toUpperCase()
        });

        return this.generateAuthResponse(user);
    }

    async login(email, password) {
        const user = await User.findOne({ email });
        if (!user) return { error: 'Credenciales inválidas' };

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return { error: 'Credenciales inválidas' };

        return this.generateAuthResponse(user);
    }

    generateAuthResponse(user) {
        const token = jwt.sign(
            { id: user._id, role: user.role, nickname: user.nickname },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return {
            user: {
                id: user._id,
                nickname: user.nickname,
                email: user.email,
                role: user.role,
                reputation: user.reputation,
                avatar: user.avatar
            },
            token
        };
    }

    async getUserById(id) {
        return await User.findById(id).select('-password');
    }

    async updateReputation(id, points) {
        return await User.findByIdAndUpdate(id, { $inc: { reputation: points } }, { new: true });
    }
}

module.exports = new UserService();

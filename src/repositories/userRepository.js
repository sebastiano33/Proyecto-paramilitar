const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class UserRepository {
    constructor() {
        this.dataPath = path.join(__dirname, '../data/users.json');
        this.users = new Map();
        this.refreshTokens = new Set();
        this.loadUsers();
    }

    loadUsers() {
        try {
            if (!fs.existsSync(this.dataPath)) {
                fs.writeFileSync(this.dataPath, '[]');
            }
            const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
            data.forEach(user => this.users.set(user.id, user));
            console.log(`[UserRepository] ${this.users.size} usuarios cargados.`);
        } catch (err) {
            console.error('[UserRepository] Error al cargar usuarios:', err);
        }
    }

    saveUsers() {
        try {
            const data = Array.from(this.users.values());
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('[UserRepository] Error al guardar usuarios:', err);
        }
    }

    async findByUsername(username) {
        return Array.from(this.users.values()).find(u => u.username === username);
    }

    async findByEmail(email) {
        return Array.from(this.users.values()).find(u => u.email === email);
    }

    async findById(id) {
        return this.users.get(id);
    }

    async getAll() {
        return Array.from(this.users.values());
    }


    async create(userData) {
        const newUser = {
            id: uuidv4(),
            reputationScore: 0,
            badges: [],
            role: 'user',
            avatar: null,
            bio: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...userData
        };
        this.users.set(newUser.id, newUser);
        this.saveUsers();
        return newUser;
    }

    // Refresh Tokens Management
    addRefreshToken(token) {
        this.refreshTokens.add(token);
    }

    isValidRefreshToken(token) {
        return this.refreshTokens.has(token);
    }

    removeRefreshToken(token) {
        this.refreshTokens.delete(token);
    }
}

module.exports = new UserRepository();

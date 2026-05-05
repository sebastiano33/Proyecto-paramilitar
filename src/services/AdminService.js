const userRepository = require('../repositories/userRepository');
const socialService = require('./SocialService');
const gpsStore = require('./gpsStore');

class AdminService {
    async getKpis() {
        const users = await userRepository.getAll(); // Necesitaré agregar getAll() al repo
        const activeBuses = await gpsStore.getAllActiveBuses();
        const posts = socialService.posts;
        
        return {
            totalUsers: users.length,
            activeBuses: activeBuses.length,
            totalPosts: posts.length,
            activeAlerts: posts.filter(p => p.type === 'alert' && p.isActive).length,
            avgReputation: Math.round(users.reduce((acc, u) => acc + (u.reputationScore || 0), 0) / users.length)
        };
    }
}

module.exports = new AdminService();

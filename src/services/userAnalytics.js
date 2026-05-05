const fs = require('fs');
const path = require('path');

class UserAnalyticsService {
    constructor() {
        this.postsPath = path.join(__dirname, '../data/posts.json');
        this.reputationPath = path.join(__dirname, '../data/reputation_events.json');
    }

    getStats(userId) {
        const posts = JSON.parse(fs.readFileSync(this.postsPath, 'utf8'));
        const userPosts = posts.filter(p => p.authorId === userId);
        
        const totalTrips = userPosts.filter(p => p.type === 'waiting').length;
        const carbonSaved = (totalTrips * 8 * (0.192 - 0.089)).toFixed(1);
        const moneySaved = totalTrips * 8 * 1800 - totalTrips * 2950;

        return {
            travel: {
                totalTrips,
                carbonSaved_kg: carbonSaved,
                moneySaved_COP: moneySaved
            },
            social: {
                postsPublished: userPosts.length,
                alertsPublished: userPosts.filter(p => p.type === 'alert').length,
                peopleHelped: userPosts.filter(p => p.type === 'alert').length * 35
            },
            insights: this.generateInsights(totalTrips, carbonSaved)
        };
    }

    generateInsights(trips, co2) {
        const insights = [];
        if (trips >= 5) insights.push(`Has ahorrado dinero en ${trips} viajes comparado con Uber.`);
        if (co2 >= 1) insights.push(`Evitaste ${co2} kg de CO₂, lo que equivale a plantar ${Math.round(co2/21)} árboles.`);
        return insights.slice(0, 3);
    }
}

module.exports = new UserAnalyticsService();

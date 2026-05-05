class SocialService {
    constructor() {
        this.posts = []; // { id, userId, nickname, avatar, type, message, routeId, stopName, timestamp, reactions: {}, comments: [] }
        this.trendingData = {
            stops: new Map(),
            routes: new Map()
        };
    }

    createPost(data) {
        const post = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            reactions: { useful: 0, arrived: 0, alert: 0, thanks: 0 },
            comments: [],
            ...data
        };
        this.posts.unshift(post); // El más nuevo al principio
        
        // Actualizar tendencias
        if (data.stopName) {
            const count = this.trendingData.stops.get(data.stopName) || 0;
            this.trendingData.stops.set(data.stopName, count + 1);
        }

        return post;
    }

    addComment(postId, commentData) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return null;

        const comment = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            ...commentData
        };
        post.comments.push(comment);
        return comment;
    }

    addReaction(postId, type) {
        const post = this.posts.find(p => p.id === postId);
        if (!post || !post.reactions.hasOwnProperty(type)) return null;

        post.reactions[type]++;
        return post.reactions;
    }

    getFeed() {
        return this.posts.slice(0, 50); // Últimos 50 posts
    }

    getTrending() {
        return {
            stops: Array.from(this.trendingData.stops.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            routes: Array.from(this.trendingData.routes.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
        };
    }
}

module.exports = new SocialService();

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const reputationService = require('./ReputationService');

class SocialService {
    constructor() {
        this.postsPath = path.join(__dirname, '../data/posts.json');
        this.commentsPath = path.join(__dirname, '../data/comments.json');
        this.posts = [];
        this.comments = [];
        this.maxPosts = 500;
        this.loadData();
        this.startExpirationJob();
    }

    loadData() {
        try {
            if (fs.existsSync(this.postsPath)) this.posts = JSON.parse(fs.readFileSync(this.postsPath, 'utf8'));
            if (fs.existsSync(this.commentsPath)) this.comments = JSON.parse(fs.readFileSync(this.commentsPath, 'utf8'));
        } catch (e) { console.error('[SocialService] Error loading data:', e); }
    }

    saveData() {
        // Rotar posts si exceden el límite
        if (this.posts.length > this.maxPosts) {
            this.posts = this.posts.slice(-this.maxPosts);
        }
        fs.writeFileSync(this.postsPath, JSON.stringify(this.posts, null, 2));
        fs.writeFileSync(this.commentsPath, JSON.stringify(this.comments, null, 2));
    }

    async createPost(data, authorId) {
        const post = {
            id: uuidv4(),
            authorId,
            reactions: { like: 0, useful: 0, warning: 0, laugh: 0 },
            userReactions: {},
            commentsCount: 0,
            shareCount: 0,
            views: 0,
            isActive: true,
            createdAt: new Date(),
            ...data
        };

        if (post.type === 'alert' && post.alertData) {
            const durations = { accident: 120, road_block: 120, bus_delay: 45, bus_full: 30, bus_missing: 30 };
            const minutes = durations[post.alertData.category] || 60;
            post.alertData.expiresAt = new Date(Date.now() + minutes * 60000);
            await reputationService.addReputation(authorId, 'ALERT_VERIFIED', post.id, 'alert');
        }

        this.posts.push(post);
        this.saveData();
        return post;
    }

    async reactToPost(postId, userId, reactionType) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return null;

        const currentReaction = post.userReactions[userId];
        
        if (currentReaction === reactionType) {
            // Toggle off
            delete post.userReactions[userId];
            post.reactions[reactionType]--;
        } else {
            // Change or add
            if (currentReaction) post.reactions[currentReaction]--;
            post.userReactions[userId] = reactionType;
            post.reactions[reactionType]++;
        }

        this.saveData();
        return post.reactions;
    }

    startExpirationJob() {
        setInterval(() => {
            const now = new Date();
            let changed = false;
            this.posts.forEach(post => {
                if (post.type === 'alert' && post.isActive && post.alertData.expiresAt) {
                    if (new Date(post.alertData.expiresAt) < now) {
                        post.isActive = false;
                        changed = true;
                        // Emitir via IO (se manejará en el socketHandler)
                        console.log(`[SocialService] Alert ${post.id} expired`);
                    }
                }
            });
            if (changed) this.saveData();
        }, 60000);
    }

    getFeed(query) {
        let filtered = this.posts.filter(p => p.isActive);
        
        if (query.scope === 'route') filtered = filtered.filter(p => p.location.routeId === query.routeId);
        if (query.scope === 'stop') filtered = filtered.filter(p => p.location.stopId === query.stopId);
        
        // Ordenar: Alertas high severity primero, luego cronológico
        return filtered.sort((a, b) => {
            const aSev = a.type === 'alert' && a.alertData.severity === 'high' ? 1 : 0;
            const bSev = b.type === 'alert' && b.alertData.severity === 'high' ? 1 : 0;
            if (aSev !== bSev) return bSev - aSev;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }
}

module.exports = new SocialService();

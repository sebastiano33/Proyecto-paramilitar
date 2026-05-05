const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { upload, processImage } = require('../middleware/upload');
const reputationService = require('../services/ReputationService');
const catchAsync = require('../utils/catchAsync');

const complaintsPath = path.join(__dirname, '../data/complaints.json');

const getComplaints = () => {
    if (!fs.existsSync(complaintsPath)) return [];
    return JSON.parse(fs.readFileSync(complaintsPath, 'utf8'));
};

const saveComplaints = (data) => {
    fs.writeFileSync(complaintsPath, JSON.stringify(data, null, 2));
};

const calculatePriority = (votes) => {
    if (votes >= 20) return 'critical';
    if (votes >= 10) return 'high';
    if (votes >= 4) return 'medium';
    return 'low';
};

// POST /complaints
router.post('/', optionalAuth, upload.array('images', 3), processImage, catchAsync(async (req, res) => {
    const complaints = getComplaints();
    const isAnonymous = req.body.isAnonymous === 'true' || !req.user;
    
    const newComplaint = {
        id: uuidv4(),
        authorId: req.user ? req.user.id : null,
        isAnonymous,
        category: req.body.category,
        subcategory: req.body.subcategory,
        title: req.body.title,
        description: req.body.description,
        mediaUrls: req.body.mediaUrls || [],
        location: JSON.parse(req.body.location || '{}'),
        status: 'received',
        statusHistory: [{ status: 'received', changedAt: new Date(), changedBy: 'system', note: 'Reporte recibido' }],
        votes: 0,
        votedBy: [],
        priority: 'low',
        isPublic: req.body.isPublic !== 'false',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    complaints.push(newComplaint);
    saveComplaints(complaints);

    if (req.user) {
        await reputationService.addReputation(req.user.id, 'ALERT_VERIFIED', newComplaint.id, 'alert');
    }

    // Socket alert para admins si es seguridad
    const io = req.app.get('io');
    if (newComplaint.category === 'safety') {
        io.to('complaints:admin').emit('safety:alert', newComplaint);
    }
    io.to('complaints:public').emit('complaint:new', newComplaint);

    res.status(201).json({ success: true, complaint: newComplaint });
}));

// GET /complaints
router.get('/', catchAsync(async (req, res) => {
    const complaints = getComplaints().filter(c => c.isPublic);
    res.json({ success: true, complaints });
}));

// POST /complaints/:id/vote
router.post('/:id/vote', authenticateToken, catchAsync(async (req, res) => {
    const complaints = getComplaints();
    const complaint = complaints.find(c => c.id === req.params.id);
    if (!complaint) return res.status(404).json({ error: 'No encontrado' });

    const voteIdx = complaint.votedBy.indexOf(req.user.id);
    if (voteIdx > -1) {
        complaint.votedBy.splice(voteIdx, 1);
        complaint.votes--;
    } else {
        complaint.votedBy.push(req.user.id);
        complaint.votes++;
    }

    const oldPriority = complaint.priority;
    complaint.priority = calculatePriority(complaint.votes);
    saveComplaints(complaints);

    const io = req.app.get('io');
    if (complaint.priority !== oldPriority && ['high', 'critical'].includes(complaint.priority)) {
        io.to('complaints:admin').emit('complaint:escalated', complaint);
    }

    res.json({ success: true, votes: complaint.votes, priority: complaint.priority });
}));

module.exports = router;

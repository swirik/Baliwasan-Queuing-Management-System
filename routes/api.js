const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TicketLog = require('../models/TicketLog');

const mediaDir = path.join(__dirname, '..', 'public', 'media');

if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mediaDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});

const upload = multer({ storage: storage });

router.post('/api/admin-login', (req, res) => {
    const { username, password } = req.body;
    const correctPassword = process.env.ADMIN_PASS || 'Padayon2026!';
    
    if (username === 'admin' && password === correctPassword) {
        res.cookie('baliwasanAdminAuth', 'secure_auth_token', { httpOnly: true });
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

router.post('/upload', upload.single('mediaFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = '/media/' + req.file.filename;
    res.json({ url: fileUrl });
});

router.get('/export', async (req, res) => {
    try {
        const logs = await TicketLog.find({}).sort({ timestamp: -1 });
        let csv = "Date,Time,Ticket,Category,Document,Priority,Status\n";
        logs.forEach(l => {
            const timeStr = l.timestamp.toISOString().split('T')[1].substring(0, 8);
            const statusStr = l.status || 'unknown'; 
            csv += `${l.date},${timeStr},${l.category}-${l.ticketNumber},${l.category},${l.document},${l.priority},${statusStr}\n`;
        });
        
        res.header('Content-Type', 'text/csv');
        res.attachment('baliwasan_queue_report.csv');
        return res.send(csv);
    } catch (err) {
        res.status(500).send("Export failed");
    }
});

module.exports = router;
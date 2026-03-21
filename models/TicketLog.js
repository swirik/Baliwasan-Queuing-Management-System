const mongoose = require('mongoose');

const TicketLogSchema = new mongoose.Schema({
    ticketNumber: Number,
    category: String,
    document: String,
    priority: String,
    date: String,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TicketLog', TicketLogSchema);
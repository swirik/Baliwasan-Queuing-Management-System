const mongoose = require('mongoose');

const StateSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    data: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('State', StateSchema);
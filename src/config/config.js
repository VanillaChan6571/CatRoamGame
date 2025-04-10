// Bot configuration
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const tmi = require('tmi.js');

// Twitch Bot Configuration - Load from environment variables
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_OAUTH_TOKEN = process.env.BOT_OAUTH_TOKEN;
const CHANNELS = process.env.CHANNELS ? process.env.CHANNELS.split(',') : ['your_channel'];
const DEBUG = process.env.DEBUG === 'true';

// Create Twitch client
const client = new tmi.Client({
    options: { debug: DEBUG },
    identity: {
        username: BOT_USERNAME,
        password: BOT_OAUTH_TOKEN
    },
    channels: CHANNELS
});

module.exports = {
    BOT_USERNAME,
    BOT_OAUTH_TOKEN,
    CHANNELS,
    DEBUG,
    client
};
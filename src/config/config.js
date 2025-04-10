// Bot configuration
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const tmi = require('tmi.js');

// Twitch Bot Configuration - Load from environment variables
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_OAUTH_TOKEN = process.env.BOT_OAUTH_TOKEN;
const MAIN_CHANNEL = process.env.CHANNELS ? process.env.CHANNELS.split(',')[0] : 'your_channel';
const DEBUG = process.env.DEBUG === 'true';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';

// Create Twitch client with initial channel
const client = new tmi.Client({
    options: { debug: DEBUG },
    identity: {
        username: BOT_USERNAME,
        password: BOT_OAUTH_TOKEN
    },
    channels: [MAIN_CHANNEL]
});

// Store current channels the bot is connected to
let CHANNELS = [MAIN_CHANNEL];

// Function to join a new channel
function joinChannel(channelName) {
    return new Promise((resolve, reject) => {
        // Check if already in this channel
        if (CHANNELS.includes(channelName.toLowerCase())) {
            resolve(false);
            return;
        }

        client.join(channelName)
            .then(() => {
                // Add to channels array if not already there
                if (!CHANNELS.includes(channelName.toLowerCase())) {
                    CHANNELS.push(channelName.toLowerCase());
                }
                console.log(`Joined channel: ${channelName}`);
                resolve(true);
            })
            .catch((err) => {
                console.error(`Error joining channel ${channelName}:`, err);
                reject(err);
            });
    });
}

// Function to leave a channel
function leaveChannel(channelName) {
    return new Promise((resolve, reject) => {
        // Don't leave the main channel
        if (channelName.toLowerCase() === MAIN_CHANNEL.toLowerCase()) {
            resolve(false);
            return;
        }

        client.part(channelName)
            .then(() => {
                // Remove from channels array
                CHANNELS = CHANNELS.filter(ch => ch.toLowerCase() !== channelName.toLowerCase());
                console.log(`Left channel: ${channelName}`);
                resolve(true);
            })
            .catch((err) => {
                console.error(`Error leaving channel ${channelName}:`, err);
                reject(err);
            });
    });
}

module.exports = {
    BOT_USERNAME,
    BOT_OAUTH_TOKEN,
    TWITCH_CLIENT_ID,
    MAIN_CHANNEL,
    DEBUG,
    client,
    CHANNELS,
    joinChannel,
    leaveChannel
};
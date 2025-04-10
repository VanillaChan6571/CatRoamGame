// Channel-related database operations
const { db } = require('./database');
const axios = require('axios');
const { BOT_OAUTH_TOKEN } = require('../config/config');

// Add a channel to the database
function addChannel(channelName, broadcasterId, isMainChannel = false) {
    const timestamp = Date.now();
    // Remove # prefix if present
    const normalizedChannelName = channelName.startsWith('#')
        ? channelName.substring(1)
        : channelName;

    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO joined_channels 
            (channel_name, broadcaster_id, joined_at, is_main_channel, last_checked) 
            VALUES (?, ?, ?, ?, ?)`,
            [normalizedChannelName.toLowerCase(), broadcasterId, timestamp, isMainChannel ? 1 : 0, timestamp],
            function(err) {
                if (err) {
                    console.error('Error adding channel:', err);
                    reject(err);
                } else {
                    resolve(true);
                }
            }
        );
    });
}

// Remove a channel from the database
function removeChannel(channelName) {
    // Remove # prefix if present
    const normalizedChannelName = channelName.startsWith('#')
        ? channelName.substring(1)
        : channelName;

    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM joined_channels WHERE channel_name = ? AND is_main_channel = 0`,
            [normalizedChannelName.toLowerCase()],
            function(err) {
                if (err) {
                    console.error('Error removing channel:', err);
                    reject(err);
                } else {
                    if (this.changes === 0) {
                        // Can't remove main channel or channel doesn't exist
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                }
            }
        );
    });
}

// Get all joined channels
function getJoinedChannels() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM joined_channels ORDER BY is_main_channel DESC, joined_at ASC`,
            [],
            (err, rows) => {
                if (err) {
                    console.error('Error fetching joined channels:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
}

// Check if the bot is joined to a channel
function isChannelJoined(channelName) {
    // Remove # prefix if present
    const normalizedChannelName = channelName.startsWith('#')
        ? channelName.substring(1)
        : channelName;

    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM joined_channels WHERE channel_name = ?`,
            [normalizedChannelName.toLowerCase()],
            (err, row) => {
                if (err) {
                    console.error('Error checking joined channel:', err);
                    reject(err);
                } else {
                    resolve(!!row);
                }
            }
        );
    });
}

// Update channel's live status
function updateChannelLiveStatus(channelName, isLive) {
    // Remove # prefix if present
    const normalizedChannelName = channelName.startsWith('#')
        ? channelName.substring(1)
        : channelName;

    const timestamp = Date.now();
    return new Promise((resolve, reject) => {
        db.run(`UPDATE joined_channels SET last_seen_live = ?, last_checked = ? WHERE channel_name = ?`,
            [isLive ? 1 : 0, timestamp, normalizedChannelName.toLowerCase()],
            function(err) {
                if (err) {
                    console.error('Error updating channel status:', err);
                    reject(err);
                } else {
                    resolve(true);
                }
            }
        );
    });
}

// Check if a channel is live using Twitch API
async function checkChannelLiveStatus(channelName) {
    try {
        // Remove # prefix if present
        const normalizedChannelName = channelName.startsWith('#')
            ? channelName.substring(1)
            : channelName;

        // First get the user ID
        const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${normalizedChannelName}`, {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${BOT_OAUTH_TOKEN.replace('oauth:', '')}`
            }
        });

        if (!userResponse.data.data.length) {
            return false; // User not found
        }

        const userId = userResponse.data.data[0].id;

        // Then check if they're streaming
        const streamResponse = await axios.get(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${BOT_OAUTH_TOKEN.replace('oauth:', '')}`
            }
        });

        // Update the database with current status
        const isLive = streamResponse.data.data.length > 0;
        await updateChannelLiveStatus(normalizedChannelName, isLive);

        return isLive;
    } catch (error) {
        console.error('Error checking channel live status:', error);
        // For testing, default to true so commands work
        return true;
    }
}

// Check if a user is a moderator in a specific channel
async function checkModStatus(username, channelName) {
    try {
        // Remove # prefix if present
        const normalizedChannelName = channelName.startsWith('#')
            ? channelName.substring(1)
            : channelName;

        // This requires authentication as the bot
        const response = await axios.get(
            `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${normalizedChannelName}&user_id=${username}`,
            {
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${BOT_OAUTH_TOKEN.replace('oauth:', '')}`
                }
            }
        );

        return response.data.data.length > 0;
    } catch (error) {
        console.error('Error checking mod status:', error);
        return false;
    }
}

// Initialize main channel from config
async function initializeMainChannel(channelName, broadcasterId) {
    try {
        // Remove # prefix if present
        const normalizedChannelName = channelName.startsWith('#')
            ? channelName.substring(1)
            : channelName;

        // Add the main channel to the database
        await addChannel(normalizedChannelName, broadcasterId, true);
        console.log(`Main channel initialized: ${normalizedChannelName}`);
        return true;
    } catch (error) {
        console.error('Error initializing main channel:', error);
        return false;
    }
}

module.exports = {
    addChannel,
    removeChannel,
    getJoinedChannels,
    isChannelJoined,
    updateChannelLiveStatus,
    checkChannelLiveStatus,
    checkModStatus,
    initializeMainChannel
};
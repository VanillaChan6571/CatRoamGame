// Main entry point for the Twitch Game Bot
require('dotenv').config();
const { client, BOT_USERNAME, BOT_OAUTH_TOKEN, MAIN_CHANNEL, DEBUG, joinChannel } = require('./config/config');
const { setupCommandListener } = require('./handlers/commandHandler');
const { startGameLoop } = require('./handlers/gameLogic');
const { getJoinedChannels, initializeMainChannel } = require('./db/channelQueries');
const { handleChannelStartup } = require('./handlers/channelCommands');
const {
    initDatabase,
    initSessionTracking,
    recordBotSession,
    checkPreviousBotSession
} = require('./db/database');

// Initialize the database
initDatabase();
// Initialize session tracking
initSessionTracking();

// Global flag to track if this is a restart
let isRestart = false;

// Log configuration (without revealing sensitive information)
console.log('Bot Configuration:');
console.log(`- Username: ${BOT_USERNAME}`);
console.log(`- OAuth Token: ${BOT_OAUTH_TOKEN ? '[Set]' : '[Not Set]'}`);
console.log(`- Main Channel: ${MAIN_CHANNEL}`);
console.log(`- Debug Mode: ${DEBUG}`);

// Initialize and join all channels
async function initializeChannels() {
    try {
        console.log('Initializing channels...');

        // Make sure main channel is in database
        // We need to make an API call to get the broadcaster ID first in production
        // For simplicity, using a placeholder here
        await initializeMainChannel(MAIN_CHANNEL, 'main_broadcaster_id');

        // Get all channels from database
        const channels = await getJoinedChannels();
        console.log(`Found ${channels.length} channel(s) in database`);

        // Join each channel (main channel is already joined at client creation)
        for (const channel of channels) {
            if (channel.channel_name.toLowerCase() !== MAIN_CHANNEL.toLowerCase()) {
                try {
                    console.log(`Joining channel: ${channel.channel_name}`);
                    await joinChannel(channel.channel_name);
                } catch (error) {
                    console.error(`Failed to join channel ${channel.channel_name}:`, error);
                }
            }
        }

        console.log('All channels initialized');
        return channels;
    } catch (error) {
        console.error('Error initializing channels:', error);
        return [{ channel_name: MAIN_CHANNEL, is_main_channel: 1 }];
    }
}

// Check if this is a restart
async function checkIfRestart() {
    return new Promise((resolve) => {
        checkPreviousBotSession((hadPrevSession) => {
            isRestart = hadPrevSession;
            console.log(`Bot startup type: ${isRestart ? 'RESTART' : 'FIRST START'}`);
            resolve(isRestart);
        });
    });
}

// Connect to Twitch with enhanced error handling
async function startBot() {
    // First check if this is a restart
    await checkIfRestart();

    // Record this session
    recordBotSession(isRestart);

    try {
        await client.connect();
        console.log('Connected to Twitch successfully!');

        // Add event listeners for important events
        client.on('connected', (address, port) => {
            console.log(`Connected to Twitch chat at ${address}:${port}`);
        });

        client.on('join', (channel, username, self) => {
            if (self) {
                console.log(`Successfully joined channel: ${channel}`);
            }
        });

        client.on('disconnected', (reason) => {
            console.log(`Disconnected from Twitch: ${reason}`);
        });

        // Initialize all channels from database
        const channels = await initializeChannels();

        // Start the game loop
        startGameLoop();

        // Set up command listener
        setupCommandListener(client);

        console.log('Bot is fully initialized and running...');

        // Send startup messages to each channel
        setTimeout(async () => {
            try {
                for (const channel of channels) {
                    await handleChannelStartup(channel.channel_name, isRestart);
                }
            } catch (err) {
                console.error('Error sending startup messages:', err);
            }
        }, 5000);
    } catch (err) {
        console.error('Failed to connect to Twitch:', err);
        process.exit(1);
    }
}

// Start the bot
startBot();

// For debugging purposes only
if (process.env.DEBUG === 'true') {
    console.log('Running in DEBUG mode');

    // Run debug scenario if enabled
    const { runDebugScenario } = require('./utils/debug');

    // Uncomment to run the debug scenario
    // setTimeout(runDebugScenario, 10000);
}

// Handle reconnection events
client.on('reconnect', () => {
    console.log('Attempting to reconnect to Twitch...');
});

client.on('connected', async (address, port) => {
    if (global.reconnecting) {
        console.log(`Reconnected to Twitch chat at ${address}:${port}`);

        // Re-initialize channels after reconnect
        const channels = await initializeChannels();

        // Send reconnect messages
        setTimeout(async () => {
            try {
                for (const channel of channels) {
                    await handleChannelStartup(channel.channel_name, true);
                }
            } catch (err) {
                console.error('Error sending reconnect messages:', err);
            }
        }, 5000);

        global.reconnecting = false;
    }
});

// Set reconnecting flag on disconnect
client.on('disconnected', () => {
    global.reconnecting = true;
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down bot...');
    client.disconnect();
    process.exit(0);
});

// Check if essential environment variables are set
console.log('Environment Check:');
console.log(`- BOT_USERNAME: ${process.env.BOT_USERNAME ? 'Set' : 'NOT SET'}`);
console.log(`- BOT_OAUTH_TOKEN: ${process.env.BOT_OAUTH_TOKEN ? 'Set' : 'NOT SET'}`);
console.log(`- TWITCH_CLIENT_ID: ${process.env.TWITCH_CLIENT_ID ? 'Set' : 'NOT SET'}`);
console.log(`- CHANNELS: ${process.env.CHANNELS ? 'Set' : 'NOT SET'}`);
console.log(`- DEBUG: ${process.env.DEBUG}`);

// If critical variables are missing, log a warning
if (!process.env.TWITCH_CLIENT_ID || !process.env.BOT_OAUTH_TOKEN) {
    console.warn('WARNING: Missing critical Twitch API credentials. Commands in non-main channels may not work correctly.');
    console.warn('Please ensure your .env file has TWITCH_CLIENT_ID and BOT_OAUTH_TOKEN set correctly.');
}
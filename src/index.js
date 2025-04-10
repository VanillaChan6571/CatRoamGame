// Main entry point for the Twitch Game Bot
require('dotenv').config();
const { client, BOT_USERNAME, BOT_OAUTH_TOKEN, MAIN_CHANNEL, DEBUG, joinChannel } = require('./config/config');
const { setupCommandListener } = require('./handlers/commandHandler');
const { startGameLoop } = require('./handlers/gameLogic');
const { getJoinedChannels, initializeMainChannel } = require('./db/channelQueries');
const { handleChannelStartup } = require('./handlers/channelCommands');

// Initialize the database (automatically happens when imported)
require('./db/database');

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

// Connect to Twitch with enhanced error handling
client.connect()
    .then(async () => {
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
                    await handleChannelStartup(channel.channel_name, false);
                }
            } catch (err) {
                console.error('Error sending startup messages:', err);
            }
        }, 5000);
    })
    .catch(err => {
        console.error('Failed to connect to Twitch:', err);
        process.exit(1);
    });

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
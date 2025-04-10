// Main entry point for the Twitch Game Bot
require('dotenv').config();
const { client, BOT_USERNAME, BOT_OAUTH_TOKEN, CHANNELS, DEBUG } = require('./config/config');
const { setupCommandListener } = require('./handlers/commandHandler');
const { startGameLoop } = require('./handlers/gameLogic');

// Initialize the database (automatically happens when imported)
require('./db/database');

// Log configuration (without revealing sensitive information)
console.log('Bot Configuration:');
console.log(`- Username: ${BOT_USERNAME}`);
console.log(`- OAuth Token: ${BOT_OAUTH_TOKEN ? '[Set]' : '[Not Set]'}`);
console.log(`- Channels: ${CHANNELS.join(', ')}`);
console.log(`- Debug Mode: ${DEBUG}`);

// Connect to Twitch with enhanced error handling
client.connect()
    .then(() => {
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

        // Start the game loop
        startGameLoop();

        // Set up command listener
        setupCommandListener(client);

        console.log('Bot is fully initialized and running...');

        // Send a test message to verify functionality
        if (DEBUG) {
            setTimeout(() => {
                try {
                    console.log(`Attempting to send test message to channel: ${CHANNELS[0]}`);
                    client.say(CHANNELS[0], 'Bot Online! Looking out for commands now!');
                    console.log('Test message sent successfully');
                } catch (err) {
                    console.error('Failed to send test message:', err);
                }
            }, 5000);
        }
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

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down bot...');
    client.disconnect();
    process.exit(0);
});
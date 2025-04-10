// Main entry point for the Twitch Game Bot
require('dotenv').config();
const { client } = require('./config/config');
const { setupCommandListener } = require('./handlers/commandHandler');
const { startGameLoop } = require('./handlers/gameLogic');

// Initialize the database (automatically happens when imported)
require('./db/database');

// Connect to Twitch
client.connect()
    .then(() => {
        console.log('Connected to Twitch successfully!');

        // Start the game loop
        startGameLoop();

        // Set up command listener
        setupCommandListener(client);

        console.log('Bot is fully initialized and running...');
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
    // setTimeout(runDebugScenario, 3000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down bot...');
    client.disconnect();
    process.exit(0);
});
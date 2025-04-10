// Command handler logic
const { handleRoamCommand, handleLeaderboardCommand, handleBestCatchesCommand, handleNameHistCommand } = require('./userCommands');
const { handleDebugCommand, isModerator } = require('./modCommands');
const { DEBUG } = require('../config/config');

// Handle user commands
function handleCommand(userId, username, command, tags) {
    if (DEBUG) {
        console.log(`Handling command: ${command} from user: ${username} (${userId})`);
    }

    switch (command.toLowerCase()) {
        case "!roam":
            handleRoamCommand(userId, username);
            break;

        case "!roamboards":
        case "!roamboard": // Allow the command without the 's' as well
            handleLeaderboardCommand();
            break;

        case "!roamcaughts":
        case "!roamcaught": // Allow both spellings
            handleBestCatchesCommand();
            break;

        case "!namehist":
            handleNameHistCommand(userId, username);
            break;

        case "!debug":
            handleDebugCommand(tags);
            break;

        default:
            if (DEBUG) {
                console.log(`Unknown command: ${command}`);
            }
            break;
    }
}

// Set up command listener
function setupCommandListener(client) {
    // Listen for all messages (for debugging)
    if (DEBUG) {
        client.on('message', (channel, tags, message, self) => {
            console.log(`[CHAT] ${tags['display-name']}: ${message}`);
        });
    }

    // Listen for commands
    client.on('message', (channel, tags, message, self) => {
        // Ignore messages from the bot itself
        if (self) {
            if (DEBUG) console.log(`[SELF] Ignoring own message: ${message}`);
            return;
        }

        // Extract user information
        const userId = tags['user-id'];
        const username = tags['display-name'];

        // Handle commands
        if (message.startsWith('!')) {
            handleCommand(userId, username, message.trim(), tags);
        }
    });

    console.log('Command listener set up');
}

module.exports = {
    handleCommand,
    setupCommandListener
};
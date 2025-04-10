// Command handler logic
const { handleRoamCommand, handleLeaderboardCommand, handleBestCatchesCommand, handleNameHistCommand } = require('./userCommands');
const { handleDebugCommand, isModerator } = require('./modCommands');

// Handle user commands
function handleCommand(userId, username, command, tags) {
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

        // Add more commands here
    }
}

// Set up command listener
function setupCommandListener(client) {
    // Listen for commands
    client.on('message', (channel, tags, message, self) => {
        // Ignore messages from the bot itself
        if (self) return;

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
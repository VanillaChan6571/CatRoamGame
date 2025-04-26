// Command handler logic
const { handleRoamCommand, handleLeaderboardCommand, handleBestCatchesCommand, handleNameHistCommand } = require('./userCommands');
const { handleDebugCommand, isModerator } = require('./modCommands');
const { handleShopCommand, handleShopDetailCommand, handleBuyCommand, handleInventoryCommand, handleApplyCommand } = require('./shopCommands');
const { handleJoinCommand, handleLeaveCommand, shouldProcessCommand } = require('./channelCommands');
const { DEBUG, MAIN_CHANNEL } = require('../config/config');

// Handle user commands
async function handleCommand(userId, username, command, tags, channel) {
    // First, normalize the channel names for proper comparison
    const normalizedChannel = channel.toLowerCase().replace(/^#/, '');
    const normalizedMainChannel = MAIN_CHANNEL.toLowerCase().replace(/^#/, '');

    if (DEBUG) {
        console.log(`Handling command: ${command} from user: ${username} (${userId}) in channel: ${channel}`);
        console.log('Main channel is:', MAIN_CHANNEL);
        console.log('Normalized channel:', normalizedChannel);
        console.log('Normalized main channel:', normalizedMainChannel);
        console.log('Is this the main channel?', normalizedChannel === normalizedMainChannel);

        if (command.toLowerCase().startsWith('!roamjoin')) {
            console.log('!roamjoin command detected! Tags:', JSON.stringify(tags));
        }
    }

    // Extract the base command and arguments
    const [baseCommand, ...args] = command.toLowerCase().split(' ');
    const commandArgs = args.join(' ');

    // Special handling for join/leave commands regardless of channel status
    if (baseCommand === "!roamjoin") {
        console.log(`Processing !roamjoin from ${username} in channel: ${channel}`);

        // Only allow from main channel (unless in DEBUG mode)
        if (DEBUG || normalizedChannel === normalizedMainChannel) {
            await handleJoinCommand(userId, username, tags);
        } else {
            client.say(channel, `@${username}, the !roamjoin command can only be used in the main channel: ${MAIN_CHANNEL}`);
            console.log(`Rejected !roamjoin in non-main channel: ${channel}`);
        }
        return;
    }

    if (baseCommand === "!roamleave") {
        await handleLeaveCommand(userId, username, channel);
        return;
    }

    // Check if the channel is live (if not the main channel)
    if (normalizedChannel !== normalizedMainChannel) {
        const shouldProcess = await shouldProcessCommand(channel);
        if (!shouldProcess) {
            // Only respond occasionally to avoid spamming
            if (Math.random() < 0.25) { // 25% chance to respond
                // Send the message instead of just returning it
                client.say(channel, `Seems like ${normalizedChannel} is taking a cat nap... please wait for them to wake up!`);
            }
            return;
        }
    }

    // Process regular commands
    switch (baseCommand) {
        case "!roam":
            handleRoamCommand(userId, username, channel);
            break;

        case "!roamboards":
        case "!roamboard": // Allow the command without the 's' as well
            handleLeaderboardCommand(channel);
            break;

        case "!roamcaughts":
        case "!roamcaught": // Allow both spellings
            handleBestCatchesCommand(channel);
            break;

        case "!namehist":
            handleNameHistCommand(userId, username, channel);
            break;

        case "!debug":
            handleDebugCommand(tags, channel);
            break;

        // Shop commands
        case "!roamshop":
            if (commandArgs) {
                handleShopDetailCommand(userId, username, commandArgs, channel);
            } else {
                handleShopCommand(userId, username, channel);
            }
            break;

        case "!roambuy":
            handleBuyCommand(userId, username, commandArgs, channel);
            break;

        case "!roaminv":
        case "!roaminventory":
            handleInventoryCommand(userId, username, channel);
            break;

        case "!roamapply":
            handleApplyCommand(userId, username, commandArgs, channel);
            break;

        default:
            if (DEBUG) {
                console.log(`Unknown command: ${baseCommand}`);
            }
            break;
    }
}

// Set up command listener
function setupCommandListener(client) {
    // Listen for all messages (for debugging)
    if (DEBUG) {
        client.on('message', (channel, tags, message, self) => {
            console.log(`[CHAT] ${channel} - ${tags['display-name']}: ${message}`);
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
            handleCommand(userId, username, message.trim(), tags, channel);
        }
    });

    console.log('Command listener set up');
}

module.exports = {
    handleCommand,
    setupCommandListener
};
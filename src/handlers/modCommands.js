// Moderator commands
const { client } = require('../config/config');
const { COOLDOWN_TIME } = require('../config/constants');
const { lastMessageTime, setLastMessageTime, getGameState } = require('./gameLogic');

// Check if user is a mod
function isModerator(tags) {
    return tags.mod || tags.badges?.broadcaster === '1';
}

// Handle debug state command (moderator only)
function handleDebugCommand(tags, channel) {
    const currentTime = Date.now();

    if (isModerator(tags) && currentTime - lastMessageTime >= COOLDOWN_TIME) {
        const state = getGameState();
        client.say(channel, `Debug - Queue: ${state.queueSize}, Active players: ${state.activePlayers.length}, Cooldown: ${state.cooldownRemaining}ms`);
        setLastMessageTime(currentTime);
    }
}

// Placeholder for future mod commands
function handleResetCommand(tags, targetUserId, channel) {
    // Only moderators can use this command
    if (!isModerator(tags)) return;

    // This would reset a player's stats or state
    // Implement logic here when needed

    const currentTime = Date.now();
    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        client.say(channel, `Command structure in place for moderator reset functionality`);
        setLastMessageTime(currentTime);
    }
}

module.exports = {
    isModerator,
    handleDebugCommand,
    handleResetCommand
};
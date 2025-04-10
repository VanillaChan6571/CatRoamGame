// Channel management commands
const { client, MAIN_CHANNEL, joinChannel, leaveChannel } = require('../config/config');
const { COOLDOWN_TIME } = require('../config/constants');
const { lastMessageTime, setLastMessageTime } = require('./gameLogic');
const { addChannel, removeChannel, isChannelJoined, checkChannelLiveStatus, checkModStatus } = require('../db/channelQueries');
const { isModerator } = require('./modCommands');

// Handle join request command
async function handleJoinCommand(userId, username, tags) {
    // Only broadcasters can request the bot to join their channel
    if (!tags.badges || !tags.badges.broadcaster) {
        client.say(MAIN_CHANNEL, `@${username}, Only channel broadcasters can request the bot to join their channel.`);
        return;
    }

    const currentTime = Date.now();
    if (currentTime - lastMessageTime < COOLDOWN_TIME) {
        return; // Respect cooldown
    }

    try {
        // Check if channel is already joined
        const alreadyJoined = await isChannelJoined(username);
        if (alreadyJoined) {
            client.say(MAIN_CHANNEL, `@${username}, I'm already set up to join your channel!`);
            setLastMessageTime(currentTime);
            return;
        }

        // Check if the bot is modded in the broadcaster's channel
        // Note: We would need Twitch API integration for a proper check
        // For now, just assume it's not modded and inform the user
        client.say(MAIN_CHANNEL, `@${username}, I'll join your channel! Make sure to mod me (/mod ${client.getUsername()}) for the best experience. Use !roamleave in this channel if you want me to leave later.`);

        // Add channel to database and join
        await addChannel(username, userId);
        await joinChannel(username);

        // Send welcome message to the new channel
        const isLive = await checkChannelLiveStatus(username);
        if (isLive) {
            client.say(username, `Hello @${username}! I'm now ready to accept commands in your channel. Your viewers can use !roam to start playing! If you want me to leave, type !roamleave on https://twitch.tv/${MAIN_CHANNEL}`);
        } else {
            client.say(username, `Seems like you're taking a cat nap @${username}... I'll be ready when you go live!`);
        }

        setLastMessageTime(currentTime);
    } catch (error) {
        console.error('Error handling join command:', error);
        client.say(MAIN_CHANNEL, `@${username}, Something went wrong while trying to join your channel. Please try again later.`);
        setLastMessageTime(currentTime);
    }
}

// Handle leave command
async function handleLeaveCommand(userId, username, channelName) {
    const currentTime = Date.now();
    if (currentTime - lastMessageTime < COOLDOWN_TIME) {
        return; // Respect cooldown
    }

    try {
        // Check if this is the main channel (can't leave)
        if (channelName.toLowerCase() === MAIN_CHANNEL.toLowerCase()) {
            client.say(MAIN_CHANNEL, `@${username}, I can't leave my home channel!`);
            setLastMessageTime(currentTime);
            return;
        }

        // Only the broadcaster or a mod can request the bot to leave
        if (!isModerator(channelName, userId, username) && channelName.toLowerCase() !== username.toLowerCase()) {
            client.say(channelName, `@${username}, Only the channel broadcaster or moderators can ask me to leave.`);
            setLastMessageTime(currentTime);
            return;
        }

        // Check if in the channel to leave
        const isJoined = await isChannelJoined(channelName);
        if (!isJoined) {
            client.say(channelName, `@${username}, I'm not currently set up for this channel.`);
            setLastMessageTime(currentTime);
            return;
        }

        // Say goodbye and leave
        client.say(channelName, `Goodbye @${channelName}! It was fun helping with your cat adventures. If you want me back, visit https://twitch.tv/${MAIN_CHANNEL} and type !roamjoin`);

        // Remove from DB and leave the channel
        await removeChannel(channelName);
        await leaveChannel(channelName);

        setLastMessageTime(currentTime);
    } catch (error) {
        console.error('Error handling leave command:', error);
        client.say(channelName, `@${username}, Something went wrong while trying to leave. Please try again later.`);
        setLastMessageTime(currentTime);
    }
}

// Handle bot startup messaging for a channel
async function handleChannelStartup(channelName, isReconnect = false) {
    try {
        // Check if the channel is live
        const isLive = await checkChannelLiveStatus(channelName);

        // Different messages based on live status and whether this is a reconnect
        if (channelName.toLowerCase() === MAIN_CHANNEL.toLowerCase()) {
            // Main channel message
            if (isReconnect) {
                client.say(channelName, "Bot reconnected! Looking out for commands now!");
            } else {
                client.say(channelName, "Bot Online! Looking out for commands now!");
            }
        } else {
            // Joint channel message
            if (isLive) {
                if (isReconnect) {
                    client.say(channelName, `Sorry Master ${channelName}, I notice you're live, the goddess had an important restart! I am here and ready to accept commands again!`);
                } else {
                    client.say(channelName, `Master ${channelName} is awake! I will now prepare to establish commands now! (if you wish for me to leave, !roamleave or visit https://twitch.tv/${MAIN_CHANNEL})`);
                }
            } else {
                if (isReconnect) {
                    client.say(channelName, "My systems were updated. Master is offline while system was updated, continue sleeping...");
                } else {
                    client.say(channelName, `Seems like Master ${channelName} is taking a cat nap... please wait for them to wake up!`);
                }
            }
        }
    } catch (error) {
        console.error(`Error sending startup message to ${channelName}:`, error);
        // Fallback message
        client.say(channelName, "Bot online! Ready for commands.");
    }
}

// Check if command should be processed based on channel's live status
async function shouldProcessCommand(channelName) {
    // Always process commands in the main channel
    if (channelName.toLowerCase() === MAIN_CHANNEL.toLowerCase()) {
        return true;
    }

    try {
        // Check if the channel is live
        const isLive = await checkChannelLiveStatus(channelName);
        return isLive;
    } catch (error) {
        console.error(`Error checking if should process command for ${channelName}:`, error);
        // Default to processing if there's an error
        return true;
    }
}

module.exports = {
    handleJoinCommand,
    handleLeaveCommand,
    handleChannelStartup,
    shouldProcessCommand
};
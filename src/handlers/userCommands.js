// Regular user commands
const { client } = require('../config/config');
const { COOLDOWN_TIME } = require('../config/constants');
const { startRoam, isInGame, lastMessageTime, setLastMessageTime } = require('./gameLogic');
const { getLeaderboard, getBestCatchesLeaderboard } = require('../db/gameQueries');
const { getUsernameHistory } = require('../db/playerQueries');
const { getCatName } = require('../db/shopQueries');

// Handle roam command
function handleRoamCommand(userId, username, channel) {
    const currentTime = Date.now();

    if (isInGame(userId)) {
        // User is already in queue
        if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
            getCatName(userId, (catName) => {
                console.log(`Cat name for ${username} (${userId}): ${catName || 'not set'}`);
                let message = `Whoa! @${username}`;
                if (catName && catName.length > 0) {
                    message += `'s "${catName}"`;
                } else {
                    message += ", your cat";
                }
                message += " is already roaming! please wait for it to come back!";

                client.say(channel, message);
            });

            setLastMessageTime(currentTime);
        }
    } else {
        // Add user to queue - pass the channel parameter
        startRoam(userId, username, channel);

        if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
            getCatName(userId, (catName) => {
                console.log(`Cat name for ${username} (${userId}): ${catName || 'not set'}`);
                let message = `@${username}'s`;
                if (catName && catName.length > 0) {
                    message += ` "${catName}"`;
                } else {
                    message += " cat";
                }
                message += " is now in purrsuit~!";

                client.say(channel, message);
            });

            setLastMessageTime(currentTime);
        }
    }
}

// Handle leaderboard command
function handleLeaderboardCommand(channel) {
    const currentTime = Date.now();

    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        // Display top 5 leaderboard from database
        getLeaderboard((topPlayers) => {
            if (topPlayers.length === 0) {
                client.say(channel, "Rare Error! @VanillaChanny something has gone wrong.");
            } else {
                let message = "Top Roamers (Total Coins): ";

                topPlayers.forEach((player, index) => {
                    message += `#${index + 1} @${player.current_username} (${player.total_coins} VC)${index < topPlayers.length - 1 ? ", " : ""}`;
                });

                client.say(channel, message);
            }
        });

        setLastMessageTime(currentTime);
    }
}

// Handle best catches command
function handleBestCatchesCommand(channel) {
    const currentTime = Date.now();

    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        // Display top 5 best catches leaderboard
        getBestCatchesLeaderboard((topPlayers) => {
            if (topPlayers.length === 0) {
                client.say(channel, "Rare Error! @VanillaChanny something has gone wrong.");
            } else {
                let message = "Top Catches (Best Single Catch): ";

                topPlayers.forEach((player, index) => {
                    message += `#${index + 1} @${player.current_username} (${player.best_value} VC)${index < topPlayers.length - 1 ? ", " : ""}`;
                });

                client.say(channel, message);
            }
        });

        setLastMessageTime(currentTime);
    }
}

// Handle username history command
function handleNameHistCommand(userId, username, channel) {
    const currentTime = Date.now();

    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        // Get username history for this user
        getUsernameHistory(userId, (history) => {
            if (history.length === 0) {
                client.say(channel, `@${username} has no recorded username changes when deployed on 04/07/2025`);
            } else {
                let message = `@${username} username history: `;

                // Format dates nicely and build message
                history.forEach((entry, index) => {
                    const firstSeen = new Date(entry.first_seen).toLocaleDateString();
                    const lastSeen = entry.last_seen === 9999999999999 ?
                        "Current" : new Date(entry.last_seen).toLocaleDateString();

                    message += `${entry.username} (${firstSeen} to ${lastSeen})${index < history.length - 1 ? ", " : ""}`;
                });

                client.say(channel, message);
            }
        });

        setLastMessageTime(currentTime);
    }
}

module.exports = {
    handleRoamCommand,
    handleLeaderboardCommand,
    handleBestCatchesCommand,
    handleNameHistCommand
};
// Debug utilities - only used when DEBUG=true
const { handleCommand } = require('../handlers/commandHandler');

// Simulate users using commands for testing
function runDebugScenario() {
    console.log('Running debug scenario...');

    // Simulate some users joining the game
    setTimeout(() => {
        console.log('Debug: User1 using !roam command');
        handleCommand("12345", "User1", "!roam", {});
    }, 1000);

    setTimeout(() => {
        console.log('Debug: User2 using !roam command');
        handleCommand("67890", "User2", "!roam", {});
    }, 2000);

    setTimeout(() => {
        console.log('Debug: User3 using !roam command');
        handleCommand("13579", "User3", "!roam", {});
    }, 3000);

    // Simulate a username change for User1
    setTimeout(() => {
        console.log('Debug: User1 changed name to NewName1 and using !roam command');
        handleCommand("12345", "NewName1", "!roam", {});
    }, 10000);

    // Check leaderboard
    setTimeout(() => {
        console.log('Debug: Someone checking leaderboard');
        handleCommand("99999", "Someone", "!roamboards", {});
    }, 15000);

    // Check username history
    setTimeout(() => {
        console.log('Debug: NewName1 checking username history');
        handleCommand("12345", "NewName1", "!namehist", {});
    }, 16000);
}

module.exports = {
    runDebugScenario
};
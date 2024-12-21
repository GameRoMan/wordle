const GG_ALL_GAME_CONFIG = {
    maxGuesses: 6, // Maximum number of guesses allowed
    wordLength: 5, // Length of the word to guess
    guessesListUrl: 'https://gameroman.pages.dev/games/wordle/data/guesses.txt',
    answersListUrl: 'https://gameroman.pages.dev/games/wordle/data/answers.txt',
    webhookPlayUrl: 'https://webhooks.gameroman.workers.dev/send/wordle/play',
    webhookResultUrl: 'https://webhooks.gameroman.workers.dev/send/wordle/result',
    keyboardLayouts: {
        'QWERTY': [
            'QWERTYUIOP',
            'ASDFGHJKL',
            'ZXCVBNM'
        ],
        'AZERTY': [
            'AZERTYUIOP',
            'QSDFGHJKLM',
            'WXCVBN'
        ]
    }
};

let gameState = {
    currentRow: 0, // Current row being filled
    currentTile: 0, // Current tile being filled
    gameOver: false, // Game over flag
    userHandle: null,
    secretWord: '',
    guesses: [],
    currentSection: 'game',
    settings: {
        theme: 'system',
        keyboardLayout: 'QWERTY',
        submitButtonType: 'ENTER'
    },
    stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: [0, 0, 0, 0, 0, 0]
    }
};

function initializeGame(gameMode = 'unlimited') {
    gameState.gameMode = gameMode;
    gameState.gameOver = false;
    gameState.currentRow = 0;
    gameState.currentTile = 0;
    gameState.guesses = [];
    if (gameMode === 'daily') {
        gameState.secretWord = 'daily'; // Placeholder
    } else if (gameMode === 'unlimited') {
        gameState.secretWord = GG_ALL_GAME_CONFIG.answers[Math.floor(Math.random() * GG_ALL_GAME_CONFIG.answers.length)];
    }
    createGameBoard();
    createKeyboard();
    openSection('game');
    document.getElementById('new-game-button').style.display = 'none';
    document.getElementById('keyboard').style.display = 'grid';
}

function createGameBoard() {
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = '';
    for (let i = 0; i < GG_ALL_GAME_CONFIG.maxGuesses; i++) {
        for (let j = 0; j < GG_ALL_GAME_CONFIG.wordLength; j++) {
            const tile = document.createElement('div');
            tile.classList.add('tile');
            gameBoard.appendChild(tile);
        }
    }
}

function submitGuess() {
    const guess = gameState.guesses[gameState.currentRow].toLowerCase();
    if (!GG_ALL_GAME_CONFIG.guesses.includes(guess)) {
        alert(`Word ${guess.toUpperCase()} does not exist`);
        return;
    }
    colorTiles();
    if (guess === gameState.secretWord) {
        finishGame(true);
        sendDiscordMessage('yes');
    } else {
        if (gameState.currentRow === GG_ALL_GAME_CONFIG.maxGuesses - 1) {
            finishGame(false);
            sendDiscordMessage('no');
            alert(`Game over! The word was ${gameState.secretWord.toUpperCase()}`);
        } else {
            gameState.currentRow++;
            gameState.currentTile = 0;
        }
    }
}

function finishGame(won) {
    gameState.gameOver = true;
    document.getElementById('new-game-button').style.display = 'block';
    document.getElementById('keyboard').style.display = 'none';
    updateStats(won);
    renderStats();
    saveData();
}

function colorTiles() {
    const tiles = document.querySelectorAll('.tile');
    const guess = gameState.guesses[gameState.currentRow].toLowerCase();
    const rowTiles = [...tiles].slice(gameState.currentRow * GG_ALL_GAME_CONFIG.wordLength, (gameState.currentRow + 1) * GG_ALL_GAME_CONFIG.wordLength);
    
    const letterCounts = [...gameState.secretWord].reduce((res, char) => (res[char] = (res[char] || 0) + 1, res), {});
    
    rowTiles.forEach((tile, index) => {
        const letter = guess[index];
        const correctLetter = gameState.secretWord[index];
        
        if (letter === correctLetter) {
            tile.classList.add('correct');
            letterCounts[letter]--;
        } else if (letterCounts[letter] > 0) {
            tile.classList.add('present');
            letterCounts[letter]--;
        } else {
            tile.classList.add('absent');
        }
    });
    
    rowTiles.forEach((tile, index) => {
        const letter = guess[index];
        const correctLetter = gameState.secretWord[index];
        
        if ((letter !== correctLetter) && (letterCounts[letter] < 0)) {
            tile.classList.remove('present');
            tile.classList.add('absent');
        }
    });
    
    const keys = document.querySelectorAll('.key');
    guess.split('').forEach((letter, index) => {
        const keyElement = [...keys].find(key => key.textContent === letter.toUpperCase());
        if (letter === gameState.secretWord[index]) {
            keyElement.classList.add('correct');
            keyElement.classList.remove('present');
        } else if (gameState.secretWord.includes(letter)) {
            if (!keyElement.classList.contains('correct')) {
                keyElement.classList.add('present');
            }
        } else {
            keyElement.classList.add('absent');
        }
    });
}

async function fetchWords() {
    try {
        const responseGuesses = await fetch(GG_ALL_GAME_CONFIG.guessesListUrl);
        const responseAnswers = await fetch(GG_ALL_GAME_CONFIG.answersListUrl);
        
        if (!responseGuesses.ok) {
            throw new Error("Network response for Guesses was not ok");
        }
        if (!responseAnswers.ok) {
            throw new Error("Network response for Answers was not ok");
        }
        
        const guesses = await responseGuesses.text();
        const answers = await responseAnswers.text();
        
        GG_ALL_GAME_CONFIG.guesses = guesses.split("\n").map(word => word.trim());
        GG_ALL_GAME_CONFIG.answers = answers.split("\n").map(word => word.trim());
        
        GG_ALL_GAME_CONFIG.guesses = GG_ALL_GAME_CONFIG.guesses.concat(GG_ALL_GAME_CONFIG.answers);
    } catch (error) {
        console.error("Error fetching words:", error);
    }
    
    initializeGame();
}

function getWebhookUrl(id) {
    return ((id === 'play') ? GG_ALL_GAME_CONFIG.webhookPlayUrl : GG_ALL_GAME_CONFIG.webhookResultUrl);
}

function getMessage(id) {    
    switch (id) {
        case 'play':
            return `🎮 \`User from gameroman.pages.dev\` started playing [\`Wordle\`](<https://gameroman.pages.dev/games/wordle>)`;
        case 'yes':
            return `✅ \`User from gameroman.pages.dev\` guessed the word \`${gameState.secretWord.toUpperCase()}\` in \`${gameState.currentRow} attempts\``;
        case 'no':
            return `❌ \`User from gameroman.pages.dev\ did not guess the word \`${gameState.secretWord.toUpperCase()}\``;
        default:
            return 'Unknown';
    }
}

function getDiscordMessage(id) {
    const webhookUrl = getWebhookUrl(id);
    const message = getMessage(id);
    
    const body = JSON.stringify({
        content: message,
    });
    
    return [
        webhookUrl,
        body
    ];
}

async function sendDiscordMessage(id) {
    const [webhookUrl, body] = getDiscordMessage(id);
    
    const response = await fetch(
        webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body
        }
    );
    
    return response;
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleKeyPress('Enter');
    } else if (event.key === 'Backspace') {
        handleKeyPress('Delete');
    } else if (event.key.match(/^[a-zA-Z]$/)) {
        handleKeyPress(event.key.toUpperCase());
    }
});

function addKeyToKeybaord(KeyLabel, keyName, x = 1, y = 1) {
    const buttonElement = document.createElement('button');
    buttonElement.textContent = KeyLabel;
    buttonElement.classList.add('key');
    buttonElement.addEventListener('click', () => handleKeyPress(keyName));
    if (x === 2) {
        buttonElement.style.gridColumn = `span ${x}`;
        buttonElement.style.width = `calc(var(--key-size) * ${x} + var(--keyboard-gap))`;
    } else if (x > 2) {
        buttonElement.style.gridColumn = `span ${x}`
        buttonElement.style.width = `calc(var(--key-size) * ${x} + var(--keyboard-gap)) * ${x-1}`;
    }
    if (y === 2) {
        buttonElement.style.gridRow = `span ${y}`
        buttonElement.style.height = `calc(var(--key-size) * ${y} + var(--keyboard-gap))`;
    } else if (y > 2) {
        buttonElement.style.gridRow = `span ${y}`
        buttonElement.style.height = `calc(var(--key-size) * ${y} + var(--keyboard-gap)) * ${y-1}`;
    }
    if (keyName === 'Enter') {
        buttonElement.style.fontSize = 'var(--enter-key-font-size)';
    }
    keyboard.appendChild(buttonElement);
}

function createKeyboard() {
    const keyboard = document.getElementById('keyboard');
    keyboard.innerHTML = '';
    const keyboardLayout = GG_ALL_GAME_CONFIG.keyboardLayouts[gameState.settings.keyboardLayout];
    
    for (let key of keyboardLayout[0]) {
        addKeyToKeybaord(key, key);
    }
    for (let key of keyboardLayout[1]) {
        addKeyToKeybaord(key, key);
    }
    if (gameState.settings.keyboardLayout === 'QWERTY') {
        addKeyToKeybaord('↵', 'Enter', 1, 2);
    } else if (gameState.settings.keyboardLayout === 'AZERTY') {
        addKeyToKeybaord('↵', 'Enter', 2, 1);
    }
    for (let key of keyboardLayout[2]) {
        addKeyToKeybaord(key, key);
    }
    addKeyToKeybaord('⌫', 'Delete', 2, 1);
    if (gameState.settings.submitButtonType === 'SUBMIT') {
        addKeyToKeybaord('SUBMIT', 'Submit', 10, 1);
    }
}

function handleKeyPress(key) {
    if (gameState.gameOver) return;
    if (key === 'Enter') {
        if (gameState.currentTile === GG_ALL_GAME_CONFIG.wordLength) {
            submitGuess();
        }
    } else if (key === 'Delete' || key === 'Submit') {
        if (gameState.currentTile > 0) {
            gameState.currentTile--;
            const tiles = document.querySelectorAll('.tile');
            const currentTile = tiles[gameState.currentRow * GG_ALL_GAME_CONFIG.wordLength + gameState.currentTile];
            currentTile.textContent = '';
            gameState.guesses[gameState.currentRow] = gameState.guesses[gameState.currentRow].slice(0, -1);
        }
    } else if (gameState.currentTile < GG_ALL_GAME_CONFIG.wordLength) {
        const tiles = document.querySelectorAll('.tile');
        const currentTile = tiles[gameState.currentRow * GG_ALL_GAME_CONFIG.wordLength + gameState.currentTile];
        currentTile.textContent = key;
        gameState.guesses[gameState.currentRow] = (gameState.guesses[gameState.currentRow] || '') + key;
        gameState.currentTile++;
    }
}

function setTheme(theme) {
    gameState.settings.theme = theme;
    document.body.classList.remove('dark-mode');
    document.getElementById('settings-container').classList.remove('dark-mode');
    if (theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        document.getElementById('settings-container').classList.add('dark-mode');
    }
}

function initializeTheme() {
    const themeSelect = document.getElementById('theme-select');
    themeSelect.value = gameState.settings.theme;
    setTheme(gameState.settings.theme);
}

function setKeyboardLayout(keyboardLayout) {
    gameState.settings.keyboardLayout = keyboardLayout;
    createKeyboard();
}

function initializeKeyboardLayout() {
    const keyboardLayoutSelect = document.getElementById('keyboard-layout-select');
    keyboardLayoutSelect.value = gameState.settings.keyboardLayout;
}

function setSubmitButtonType(submitButtonType) {
    gameState.settings.submitButtonType = submitButtonType;
    createKeyboard();
}

function initializeSubmitButtonType() {
    const submitButtonTypeSelect = document.getElementById('submit-button-type-select');
    submitButtonTypeSelect.value = gameState.settings.submitButtonType;
}

function openSection(sectionName) {
    const sections = ['menu', 'game', 'stats', 'settings'];
    sections.forEach(section => {
        const container = document.getElementById(`${section}-container`);
        if (container) {
            if (section === sectionName) {
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
            }
        }
    });
    gameState.currentSection = sectionName;
    if (sectionName === 'stats') {
        renderStats();
    }
}

function updateStats(won) {
    gameState.stats.gamesPlayed++;
    if (won) {
        gameState.stats.gamesWon++;
        gameState.stats.currentStreak++;
        gameState.stats.maxStreak = Math.max(gameState.stats.maxStreak, gameState.stats.currentStreak);
        gameState.stats.guessDistribution[gameState.currentRow]++;
    } else {
        gameState.stats.currentStreak = 0;
    }
}

function renderStats() {
    const {
        stats
    } = gameState;
    document.getElementById('games-played').textContent = stats.gamesPlayed;
    document.getElementById('win-percentage').textContent = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) + '%' : '0%';
    document.getElementById('current-streak').textContent = stats.currentStreak;
    document.getElementById('max-streak').textContent = stats.maxStreak;
    const guessDistribution = document.getElementById('guess-distribution');
    guessDistribution.innerHTML = '';
    const maxGuesses = Math.max(...stats.guessDistribution, 1); // Ensure we don't divide by zero
    for (let i = 0; i < stats.guessDistribution.length; i++) {
        const row = document.createElement('div');
        row.className = 'guess-row';
        const label = document.createElement('div');
        label.className = 'guess-label';
        label.textContent = i + 1;
        const bar = document.createElement('div');
        bar.className = 'guess-bar';
        const barFill = document.createElement('div');
        barFill.className = 'guess-bar-fill';
        const percentage = (stats.guessDistribution[i] / maxGuesses) * 100;
        barFill.style.width = `${percentage}%`;
        const count = document.createElement('div');
        count.className = 'guess-count';
        count.textContent = stats.guessDistribution[i];
        bar.appendChild(barFill);
        bar.appendChild(count);
        row.appendChild(label);
        row.appendChild(bar);
        guessDistribution.appendChild(row);
    }
}

function saveData() {
    localStorage.setItem('ww-wordle-stats', JSON.stringify(gameState.stats));
    localStorage.setItem('ww-wordle-settings', JSON.stringify(gameState.settings));
}

function loadData() {
    const savedStats = localStorage.getItem('ww-wordle-stats');
    if (savedStats) {
        gameState.stats = JSON.parse(savedStats);
        renderStats();
    }
    const savedSettings = localStorage.getItem('ww-wordle-settings');
    if (savedSettings) {
        gameState.settings = JSON.parse(savedSettings);
        renderStats();
    }
}


// Settings
document.getElementById('theme-select').addEventListener('change', (event) => {
    setTheme(event.target.value);
    saveData();
});
document.getElementById('keyboard-layout-select').addEventListener('change', (event) => {
    setKeyboardLayout(event.target.value);
    saveData();
});
document.getElementById('submit-button-type-select').addEventListener('change', (event) => {
    setSubmitButtonType(event.target.value);
    saveData();
});

// Top bar
document.getElementById('menu-button').addEventListener('click', () => {
    if (gameState.currentSection !== 'menu') {
        openSection('menu');
    } else {
        openSection('game');
    }
});
document.getElementById('stats-button').addEventListener('click', () => {
    if (gameState.currentSection !== 'stats') {
        openSection('stats');
    } else {
        openSection('game');
    }
});
document.getElementById('settings-button').addEventListener('click', () => {
    if (gameState.currentSection !== 'settings') {
        openSection('settings');
    } else {
        openSection('game');
    }
});


document.getElementById('play-daily').addEventListener('click', () => {
    initializeGame('daily');
});
document.getElementById('play-unlimited').addEventListener('click', () => {
    initializeGame('unlimited');
});
document.getElementById('new-game-button').addEventListener('click', () => {
    initializeGame('unlimited');
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (gameState.settings.theme === 'system') {
        setTheme('system');
    }
});

// Game initialization
sendDiscordMessage('play');
fetchWords();
loadData();
initializeTheme();
initializeKeyboardLayout();
initializeSubmitButtonType();
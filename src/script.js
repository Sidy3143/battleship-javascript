import { Ship, Gameboard, Player } from "./modules.js";

const boardSize = 10;
let player1 = new Player(boardSize);
let player2 = new Player(boardSize);

let order = null;

// Global drag state for cross-browser preview
let currentDragPayload = null;
let gameMode = 'single';
let passOverlay = null;
let revealBtn = null;
let startBtn = null;
let placingPlayerIndex = 0; // 0 or 1 used during placement in two-player mode
let viewingPlayerIndex = 0; // 0 or 1 used during attack in two-player mode
let ready = [false, false];
// track ships placed for current placement phase (global so event listeners don't close-over stale values)
let shipPlaced = 0;

//create player a and b
// make both place ships
// Allow attack
// Check winner

function createBoard(){
    const boards = document.querySelectorAll(".board");
    
    boards.forEach(board =>{
        board.innerHTML = "";

        for (let i=0; i<boardSize; i++){
            for (let j=0; j<boardSize; j++){
                const div = document.createElement("div");

                div.dataset.column = j;
                div.dataset.row = i;
                div.classList.add("cell");

                board.appendChild(div);
            }
        }
    })
}

function showPassOverlay(playerIndex, message) {
    if (!passOverlay) return;
    passOverlay.classList.remove('hidden');
    const msg = document.getElementById('pass-message');
    msg.textContent = message || `Pass device to Player ${playerIndex + 1}`;
    revealBtn && (revealBtn.textContent = `Player ${playerIndex + 1} Ready`);
    passOverlay.setAttribute('data-for', String(playerIndex));
    console.log('showPassOverlay:', { playerIndex, overlayEl: passOverlay, datasetFor: passOverlay.getAttribute('data-for') });
    // Prevent accidental clicks to boards while overlay is visible
    document.body.classList.add('paused');
    passOverlay.style.display = 'flex';
    passOverlay.style.visibility = 'visible';
    passOverlay.setAttribute('aria-hidden', 'false');
    // While overlay is visible, ensure ship cells are hidden like they are for the computer board
    // Use view index -1 to render boards with ships hidden
    const board1 = document.getElementById('board-1');
    const board2 = document.getElementById('board-2');
    if (board1 && board2) {
        renderBoard(player1, board1, -1);
        renderBoard(player2, board2, -1);
    }
}

function hidePassOverlay() {
    if (!passOverlay) return;
    passOverlay.classList.add('hidden');
    document.body.classList.remove('paused');
    // clear the data-for attribute so we can spot if it's not set when showing
    passOverlay.removeAttribute('data-for');
    passOverlay.style.visibility = 'hidden';
    passOverlay.style.display = 'none';
    passOverlay.setAttribute('aria-hidden', 'true');
    console.log('hidePassOverlay: overlay hidden', { overlayEl: passOverlay, datasetFor: passOverlay.getAttribute('data-for') });
}

// New: create UI container and draggable ship elements
function createShipsUI() {
    let container = document.getElementById("ship-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "ship-container";
        // Prefer a .controls wrapper if present, otherwise prepend to body
            // Keep a reference to the current drag payload to support some browsers
            // currentDragPayload should be declared globally
        const wrapper = document.querySelector(".controls") || document.body;
        wrapper.prepend(container);
    }
    container.innerHTML = "";

    shipsToPlace.forEach((length, index) => {
        const shipEl = document.createElement("div");
        shipEl.classList.add("draggable-ship");
        if (!isHorizontal) shipEl.classList.add("vertical");
        shipEl.draggable = true;
        shipEl.dataset.length = length;
        shipEl.dataset.index = index;
        
        for (let i = 0; i < length; i++) {
            const mini = document.createElement("div");
            mini.classList.add("mini-cell");
            shipEl.appendChild(mini);
        }

        const countLabel = document.createElement("span");
        countLabel.classList.add("count");
        countLabel.textContent = `×${length}`;
        shipEl.appendChild(countLabel);

        container.appendChild(shipEl);

        shipEl.addEventListener("dragstart", (ev) => {
            ev.dataTransfer.setData("application/json", JSON.stringify({
                length: Number(shipEl.dataset.length),
                index: Number(shipEl.dataset.index),
            }));
            // hint the drag operation
            if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
            // Set a fallback global payload for browsers that don't expose dataTransfer in dragover
            currentDragPayload = {
                length: Number(shipEl.dataset.length),
                index: Number(shipEl.dataset.index),
            };
            shipEl.style.opacity = "0.5";
        });

        shipEl.addEventListener("dragend", (ev) => {
            shipEl.style.opacity = "1";
            clearPreview();
            currentDragPayload = null;
        });
    });
}


function renderBoard(player, board, viewAsIndex = 0){
    for (let i=0; i<player.gameBoard.size; i++){
        for (let j=0; j<player.gameBoard.size; j++){
            
            const cellEl = board.querySelector(
                `[data-row="${i}"][data-column="${j}"]`
            );

            // Show ships only to the player who owns the board (viewAsIndex determines which player is currently viewing)
            const boardOwner = board.id === 'board-1' ? 0 : 1;
            if (boardOwner === viewAsIndex && player.gameBoard.grid[i][j]) {
                cellEl.classList.add("ship");
            } else {
                cellEl.classList.remove("ship");
            }
        }
    }

}


// Toggle orientation with keyboard
let isHorizontal = true;
document.addEventListener("keydown", (e)=>{
    if (e.key === "r" || e.key === "R") {
        isHorizontal = !isHorizontal;
        order.textContent = `Orientation: ${isHorizontal ? "Horizontal" : "Vertical"}`;

        // draggable ship orientation visuals
        const ships = document.querySelectorAll(".draggable-ship");
        ships.forEach(s => {
            if (isHorizontal) {
                s.classList.remove("vertical");
            } else {
                s.classList.add("vertical");
            }
        });
    }
})


// Place the ships
const shipsToPlace = [4, 3, 3, 2];

let board1Handler = null;
let board2Handler = null;

// helper: clear preview cells
function clearPreview() {
    const prev = document.querySelectorAll(".cell.preview");
    prev.forEach(p => {
        p.classList.remove("preview");
        p.classList.remove("invalid");
    });
}

function play(){  
    let winner = false;

    const board1 = document.getElementById("board-1");;
    const board2 = document.getElementById("board-2");

    ready = [false, false];
    let isPlayerTurn = true; // for single player

    // Game mode: single or pass
    gameMode = document.querySelector('input[name="mode"]:checked')?.value || 'single';

    // Reset players' boards
    player1 = new Player(boardSize);
    player2 = new Player(boardSize);
    compTargets = [];

    if (gameMode === 'single') {
        placeComputerShips();
        renderBoard(player2, board2, 0);
        ready[1] = true;
    }

    shipPlaced = 0; // reset ships placed by currently active placing player

    // clear previous event listeners
    if (board1Handler) board1.removeEventListener("click", board1Handler);
    if (board2Handler) board2.removeEventListener("click", board2Handler);

    createShipsUI();

    // If pass-device mode, begin placement with Player 1 pass overlay
    if (gameMode === 'pass') {
        placingPlayerIndex = 0;
        shipPlaced = 0;
        showPassOverlay(0, 'Player 1, place your ships');
        // Hide the board ships until the player reveals
        const board1 = document.getElementById('board-1');
        const board2 = document.getElementById('board-2');
        renderBoard(player1, board1, 0);
        renderBoard(player2, board2, 0);
    }

    // Setup drag & drop/placement - but adjust for pass-device mode
    if (!board1.dataset.dragListeners) {
    board1.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
        
        clearPreview();
        let dataText = ev.dataTransfer && (ev.dataTransfer.getData("application/json") || ev.dataTransfer.getData("text/plain"));
        if ((!dataText || dataText === "") && currentDragPayload) {
            dataText = JSON.stringify(currentDragPayload);
        }
        if (!dataText) return;

        let payload;
        try { 
            payload = JSON.parse(dataText); 
        } catch { 
            return; 
        }

        const length = payload.length;
        
        const cell = ev.target.closest(".cell");
        if (!cell) return;
        const x = Number(cell.dataset.column);
        const y = Number(cell.dataset.row);

        // compute occupied coords, check bounds
        let coords = [];
        for (let i = 0; i < length; i++) {
            const sx = isHorizontal ? x + i : x;
            const sy = isHorizontal ? y : y + i;
            if (sx < 0 || sx >= boardSize || sy < 0 || sy >= boardSize) {
                coords = [];
                break;
            }
            coords.push({x: sx, y: sy});
        }

        // check collisions against the current placing player's board
        const placingPlayer = (gameMode === 'pass') ? (placingPlayerIndex === 0 ? player1 : player2) : player1;
        const validPlacement = coords.length && coords.every(c => !placingPlayer.gameBoard.grid[c.y][c.x]);
        if (coords.length) {
            coords.forEach(c => {
                const el = board1.querySelector(`[data-row="${c.y}"][data-column="${c.x}"]`);
                if (el) {
                    el.classList.add("preview");
                    if (!validPlacement) el.classList.add("invalid");
                    else el.classList.remove("invalid");
                }
            });
        }
    });

    board1.addEventListener("dragleave", (ev) => {
        clearPreview();
    });

    // Some browsers do not always provide payload during dragover; ensure preview still updates on dragenter.
    board1.addEventListener("dragenter", (ev) => {
        ev.preventDefault();
        // reuse dragover logic via event dispatch
        const custom = new Event('dragover', {bubbles: true});
        ev.target.dispatchEvent(custom);
    });

    // Keep preview updated while moving mouse between child elements while dragging
    board1.addEventListener("mousemove", (ev) => {
        if (!currentDragPayload && !(ev.dataTransfer && (ev.dataTransfer.types && ev.dataTransfer.types.length))) return;
        // reuse dragover logic via event dispatch
        const custom = new Event('dragover', {bubbles: true});
        ev.target.dispatchEvent(custom);
    });

    board1.addEventListener("drop", (ev) => {
        ev.preventDefault();
        clearPreview();

        let dataText = ev.dataTransfer && (ev.dataTransfer.getData("application/json") || ev.dataTransfer.getData("text/plain"));
        if ((!dataText || dataText === "") && currentDragPayload) {
            dataText = JSON.stringify(currentDragPayload);
        }
        if (!dataText) return;

        let payload;
        try { 
            payload = JSON.parse(dataText); 
        } catch { 
            return; 
        }
        const length = Number(payload.length);
        const index = Number(payload.index);

        const cell = ev.target.closest(".cell");
        if (!cell) return;

        const x = Number(cell.dataset.column);
        const y = Number(cell.dataset.row);
        
        if (shipPlaced >= shipsToPlace.length) {
            order.textContent = "All ships placed!!";
            return;
        }

        // Attempt to place the ship with current orientation
        try {
            const placingPlayer = (gameMode === 'pass') ? (placingPlayerIndex === 0 ? player1 : player2) : player1;
            if (placingPlayer.gameBoard.placeShip(x, y, length, isHorizontal)) {
            shipPlaced++;
            // remove draggable ship from UI if present
            const shipEl = document.querySelector(`.draggable-ship[data-index="${index}"]`);
            if (shipEl && shipEl.parentElement) {
                shipEl.parentElement.removeChild(shipEl);
            }
            renderBoard(placingPlayer, board1, placingPlayerIndex);
            if (shipPlaced >= shipsToPlace.length) {
                order.textContent = "All ships placed !!";
                // mark ready for the placing player
                ready[placingPlayerIndex] = true;
                // If we're in pass mode and player 0 just finished, prompt pass to player 2 for placement
                if (gameMode === 'pass') {
                    if (placingPlayerIndex === 0) {
                        // switch to player 2 placement
                        shipPlaced = 0; // reset count
                        placingPlayerIndex = 1;
                        // show pass overlay to hand to player 2
                        placingPlayerIndex = 1;
                        shipPlaced = 0;
                        createShipsUI();
                        showPassOverlay(1, 'Player 2, place your ships');
                    } else {
                        // both players placed; begin attack phase
                        order.textContent = 'Both players ready!';
                        // show pass overlay to Player 1 to start
                        placingPlayerIndex = 0;
                        viewingPlayerIndex = 0;
                        showPassOverlay(0, 'Pass device to Player 1 to begin');
                    }
                }
            }

            }
        } catch (err) {
            // placeShip throws on collision or out-of-bounds; make a friendly message
            order.textContent = "Invalid placement, try again!";
        }
    });

    board1Handler = (e)=> {
        if (winner) return;

        const cell = e.target;
        const x = Number(cell.dataset.column);
        const y = Number(cell.dataset.row);

        if (shipPlaced >= shipsToPlace.length) {
            order.textContent = "All ships placed!!";
            return ;
        }

        try {
            const placingPlayer = (gameMode === 'pass') ? (placingPlayerIndex === 0 ? player1 : player2) : player1;
            if (placingPlayer.gameBoard.placeShip(x, y, shipsToPlace[shipPlaced], isHorizontal)){
            shipPlaced++ ;
            renderBoard(placingPlayer, board1, placingPlayerIndex);
            // remove the matching draggable element by index (ensure UI stays in sync)
            const removedIndex = shipPlaced - 1;
            const shipEl = document.querySelector(`.draggable-ship[data-index="${removedIndex}"]`);
            if (shipEl && shipEl.parentElement) {
                shipEl.parentElement.removeChild(shipEl);
            }
            if (shipPlaced >= shipsToPlace.length){
                order.textContent = "All ships placed !!";
                ready[placingPlayerIndex] = true;
                if (gameMode === 'pass') {
                    if (placingPlayerIndex === 0) {
                        // finished P1 placement; show overlay to P2 for placement
                        shipPlaced = 0;
                        placingPlayerIndex = 1;
                        placingPlayerIndex = 1;
                        shipPlaced = 0;
                        createShipsUI();
                        showPassOverlay(1, 'Player 2, place your ships');
                    } else {
                        // both players placed
                        order.textContent = 'Both players ready!';
                        viewingPlayerIndex = 0; // start with P1
                        showPassOverlay(0, 'Pass device to Player 1 to begin');
                    }
                }
            }
            }
        } catch (err) {
            order.textContent = "Invalid placement, try again!";
        }
    };
    board1.addEventListener("click", board1Handler);
        board1.dataset.dragListeners = "true";
    }

        // Make board2 also support ship placement drag/drop in pass-device mode
        if (!board2.dataset.dragListeners) {
            board2.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';

                clearPreview();
                let dataText = ev.dataTransfer && (ev.dataTransfer.getData("application/json") || ev.dataTransfer.getData("text/plain"));
                if ((!dataText || dataText === "") && currentDragPayload) {
                    dataText = JSON.stringify(currentDragPayload);
                }
                if (!dataText) return;

                let payload;
                try { 
                    payload = JSON.parse(dataText); 
                } catch { 
                    return; 
                }

                const length = payload.length;
                const cell = ev.target.closest(".cell");
                if (!cell) return;
                const x = Number(cell.dataset.column);
                const y = Number(cell.dataset.row);

                let coords = [];
                for (let i = 0; i < length; i++) {
                    const sx = isHorizontal ? x + i : x;
                    const sy = isHorizontal ? y : y + i;
                    if (sx < 0 || sx >= boardSize || sy < 0 || sy >= boardSize) {
                        coords = [];
                        break;
                    }
                    coords.push({x: sx, y: sy});
                }

                const placingPlayer = (gameMode === 'pass') ? (placingPlayerIndex === 0 ? player1 : player2) : player1;
                const validPlacement = coords.length && coords.every(c => !placingPlayer.gameBoard.grid[c.y][c.x]);
                if (coords.length) {
                    coords.forEach(c => {
                        const el = board2.querySelector(`[data-row="${c.y}"][data-column="${c.x}"]`);
                        if (el) {
                            el.classList.add("preview");
                            if (!validPlacement) el.classList.add("invalid");
                            else el.classList.remove("invalid");
                        }
                    });
                }
            });

            board2.addEventListener("dragleave", (ev) => { clearPreview(); });
            board2.addEventListener("dragenter", (ev) => { ev.preventDefault(); ev.target.dispatchEvent(new Event('dragover', {bubbles: true})); });
            board2.addEventListener("mousemove", (ev) => { if (!currentDragPayload && !(ev.dataTransfer && (ev.dataTransfer.types && ev.dataTransfer.types.length))) return; ev.target.dispatchEvent(new Event('dragover', {bubbles: true})); });

            board2.addEventListener("drop", (ev) => {
                ev.preventDefault();
                clearPreview();

                let dataText = ev.dataTransfer && (ev.dataTransfer.getData("application/json") || ev.dataTransfer.getData("text/plain"));
                if ((!dataText || dataText === "") && currentDragPayload) {
                    dataText = JSON.stringify(currentDragPayload);
                }
                if (!dataText) return;

                let payload;
                try { payload = JSON.parse(dataText); } catch { return; }
                const length = Number(payload.length);
                const index = Number(payload.index);
                const cell = ev.target.closest(".cell");
                if (!cell) return;
                const x = Number(cell.dataset.column);
                const y = Number(cell.dataset.row);

                if (shipPlaced >= shipsToPlace.length) {
                    order.textContent = "All ships placed!!";
                    return;
                }

                try {
                    const placingPlayer = (gameMode === 'pass') ? (placingPlayerIndex === 0 ? player1 : player2) : player1;
                    const boardForRender = placingPlayerIndex === 0 ? board1 : board2;
                    if (placingPlayer.gameBoard.placeShip(x, y, length, isHorizontal)) {
                        shipPlaced++;
                        // remove draggable ship UI
                        const shipEl = document.querySelector(`.draggable-ship[data-index="${index}"]`);
                        if (shipEl && shipEl.parentElement) shipEl.parentElement.removeChild(shipEl);

                        renderBoard(placingPlayer, boardForRender, placingPlayerIndex);
                        if (shipPlaced >= shipsToPlace.length) {
                            order.textContent = "All ships placed !!";
                            ready[placingPlayerIndex] = true;
                            if (gameMode === 'pass') {
                                if (placingPlayerIndex === 0) {
                                    shipPlaced = 0; placingPlayerIndex = 1; createShipsUI(); showPassOverlay(1, 'Player 2, place your ships');
                                } else {
                                    order.textContent = 'Both players ready!';
                                    viewingPlayerIndex = 0; showPassOverlay(0, 'Pass device to Player 1 to begin');
                                }
                            }
                        }
                    }
                } catch(err) {
                    order.textContent = "Invalid placement, try again!";
                }
            });

            board2.dataset.dragListeners = "true";
        
        // Click-to-place fallback for Player 2 placement in pass device mode
        const board2PlacementClickHandler = (e) => {
            if (gameMode !== 'pass') return;
            if (placingPlayerIndex !== 1) return;
            const cell = e.target;
            const x = Number(cell.dataset.column);
            const y = Number(cell.dataset.row);

            if (shipPlaced >= shipsToPlace.length) {
                order.textContent = "All ships placed!!";
                return ;
            }

            try {
                const placingPlayer = player2;
                if (placingPlayer.gameBoard.placeShip(x, y, shipsToPlace[shipPlaced], isHorizontal)){
                    shipPlaced++ ;
                    renderBoard(placingPlayer, board2, 1);
                    const removedIndex = shipPlaced - 1;
                    const shipEl = document.querySelector(`.draggable-ship[data-index="${removedIndex}"]`);
                    if (shipEl && shipEl.parentElement) shipEl.parentElement.removeChild(shipEl);
                    if (shipPlaced >= shipsToPlace.length){
                        order.textContent = "All ships placed !!";
                        ready[1] = true;
                        viewingPlayerIndex = 0;
                        showPassOverlay(0, 'Pass device to Player 1 to begin');
                    }
                }
            } catch (err) {
                order.textContent = "Invalid placement, try again!";
            }
        };
        board2.addEventListener('click', board2PlacementClickHandler);
        }

    // Listener for attacking opponent (computer or human)
    board2Handler = (e)=>{
        // For single player, keep earlier logic
        if (gameMode === 'single') {
            if (winner || !ready[0] || !isPlayerTurn) return;

            const cell = e.target;
            const win = attack(cell, player2) ;
            if (win){
                winner = true;
                resetGame();

                return;
            }

            isPlayerTurn = false; 
            order.textContent = "Computer is thinking...";
            
            // Computer attacks back after a short delay
            setTimeout(() => {
                const compWon = computerAttack(player1, board1);
                if (compWon) {
                    winner = true;
                    resetGame();

                    return;
                }

                isPlayerTurn = true; 
                order.textContent = "Your turn!";
            }, 1500);
            return;
        }

        // For pass-device two player mode, only allow click if it's the viewing player's turn
        if (winner || !ready[0] || !ready[1] || viewingPlayerIndex !== 0) return; // we will check board mapping below

        const cell = e.target;
        // Player 1 clicking on board2 (attacking player2)
        const win = attack(cell, player2);
        if (win) {
            winner = true;
            resetGame();
            return;
        }

        // After player 1 attacks, switch to player 2 view
        viewingPlayerIndex = 1;
        showPassOverlay(1, 'Pass device to Player 2 for their turn');
    };
    board2.addEventListener("click", board2Handler);

    // General attack handler for board1 clicks (player2 attacking player1) in pass mode
    const board1AttackHandler = (e) => {
        if (gameMode === 'single') return;
        if (winner || !ready[0] || !ready[1] || viewingPlayerIndex !== 1) return;
        const cell = e.target;
        const win = attack(cell, player1);
        if (win) {
            winner = true;
            resetGame();
            return;
        }

        // After player 2 attacks, pass back to player 1
        viewingPlayerIndex = 0;
        showPassOverlay(0, 'Pass device to Player 1 for their turn');
    };
    board1.addEventListener("click", board1AttackHandler);
}

// Setup UI for pass overlay and start button
// Ensure DOM is ready before querying overlay elements and starting the game
document.addEventListener('DOMContentLoaded', () => {
    createBoard();
    passOverlay = document.getElementById('pass-overlay');
    revealBtn = document.getElementById('reveal-btn');
    startBtn = document.getElementById('start-btn');
    order = document.querySelector('.order');

    if (!passOverlay) console.warn('passOverlay element not found');
    else {
        // Ensure overlay is hidden at startup
        passOverlay.classList.add('hidden');
        passOverlay.style.display = 'none';
        passOverlay.setAttribute('aria-hidden', 'true');
    }
    if (!revealBtn) console.warn('revealBtn element not found');

    // showPassOverlay and hidePassOverlay are defined at module top-level and will use passOverlay

    const revealHandler = (ev) => {
        ev?.preventDefault?.();
        // find overlay and reveal attribute robustly
        const overlayEl = passOverlay || document.querySelector('#pass-overlay');
        let getAttr = overlayEl?.getAttribute('data-for');
        // fallback: parse order text if overlay doesn't have a data-for
        if (getAttr === null || getAttr === undefined) {
            const orderText = order?.textContent || '';
            const match = orderText.match(/Player\s*(\d+)/i);
            if (match) {
                getAttr = String(Number(match[1]) - 1);
                console.warn('revealHandler: fallback parsed viewing player from order text', {orderText, getAttr});
            }
        }
        console.log('Reveal clicked - overlayEl:', overlayEl, 'data-for attr:', getAttr, 'revealBtn:', !!revealBtn);
        const idx = Number(getAttr ?? 0);
        hidePassOverlay();
        const board1 = document.getElementById('board-1');
        const board2 = document.getElementById('board-2');
        // If both players are ready, we're in attack phase -> keep ships hidden for both players
        if (gameMode === 'pass' && ready[0] && ready[1]) {
            // Render both boards without ships
            renderBoard(player1, board1, -1);
            renderBoard(player2, board2, -1);
        } else {
            // During placement, reveal the placing player's own ships
            renderBoard(player1, board1, idx);
            renderBoard(player2, board2, idx);
        }
        if (!ready[0] || !ready[1]) {
            order.textContent = `Player ${idx + 1}, place your ships`;
        } else {
            order.textContent = `Player ${idx + 1}'s turn`;
        }
        viewingPlayerIndex = idx;
        // defensive: ensure we render boards when attribute was missing but overlay element exists
        if (getAttr === null || getAttr === undefined || getAttr === 'undefined') {
            console.warn('pass-overlay did not have data-for set. Forcing render and setting default viewing player. idx=', idx);
            overlayEl && overlayEl.setAttribute('data-for', String(idx));
            if (gameMode === 'pass' && ready[0] && ready[1]) {
                renderBoard(player1, board1, -1);
                renderBoard(player2, board2, -1);
            } else {
                renderBoard(player1, board1, idx);
                renderBoard(player2, board2, idx);
            }
        }
    };
    if (revealBtn) {
        revealBtn.addEventListener('click', revealHandler);
    } else {
        document.addEventListener('click', (e) => { if (e.target && e.target.id === 'reveal-btn') revealHandler(e); });
    }
    if (passOverlay) {
        passOverlay.addEventListener('click', (e) => { if (e.target === passOverlay) revealHandler(e); });
    }
    document.addEventListener('keydown', (e) => { if (!passOverlay || passOverlay.classList.contains('hidden')) return; if (e.key === 'Enter' || e.key === ' ') revealHandler(e); });

// start button will start a new game based on mode
    startBtn?.addEventListener('click', (ev) => {
    // clear overlay and start game freshly
    hidePassOverlay();
    createBoard();
    play();
    });

    // Wait for user to click New Game before starting the game - do not auto-start
    order.textContent = 'Select mode and press New Game';
});

//Attack by clicking on ships
function attack(cell, player){
    const x = Number(cell.dataset.column);
    const y = Number(cell.dataset.row);
    
    if (player.gameBoard.receiveAttack(x, y)){
        cell.classList.add("attacked");

        if(player.gameBoard.allSunk()){
            // Determine who the attacker (winner) was based on the target player
            const winnerIndex = (player === player1) ? 1 : 0;
            order.textContent = `Player ${winnerIndex + 1} won!!`;
            return true;
            //createBoard();
            //play();
        }
    } else{
        cell.classList.add("missed");
    }

    return false;
}

// Helper: Random integer in [0, max)
function randInt(max) {
    return Math.floor(Math.random() * max);
}

// Helper: Randomly place ships for computer
function placeComputerShips() {
    let placed = 0;
    while (placed < shipsToPlace.length) {
        const length = shipsToPlace[placed];
        const isHorizontal = Math.random() < 0.5;

        const x = randInt(boardSize - (isHorizontal ? length - 1 : 0));
        const y = randInt(boardSize - (isHorizontal ? 0 : length - 1));

        if (player2.gameBoard.placeShip(x, y, length, isHorizontal)) {
            placed++;
        }
    }
}

let compTargets = [];
function addAdjacentTargets(x, y, board) {
    const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
    ];
    neighbors.forEach(({ x, y }) => {
        if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
            const cell = board.querySelector(`[data-row="${y}"][data-column="${x}"]`);
            if (cell && !cell.classList.contains("attacked") && !cell.classList.contains("missed")) {
                // Avoid duplicates in queue
                if (!compTargets.some(t => t.x === x && t.y === y)) {
                    compTargets.push({ x, y });
                }
            }
        }
    });
}

// Computer makes a random attack
function computerAttack(player, board) {
    let x, y, cell;
    let attackSuccess = false;

    while (true) {
        if (compTargets.length > 0) {
            const next = compTargets.pop();
            x = next.x; y = next.y;
        } else {
            x = randInt(boardSize);
            y = randInt(boardSize);
        }

        cell = board.querySelector(`[data-row="${y}"][data-column="${x}"]`);
        
        if (!cell) break; 
        if (!cell.classList.contains("attacked") && !cell.classList.contains("missed")) {
            break;
        }
    } 
    
    attackSuccess = player.gameBoard.receiveAttack(x, y);
    
    if (attackSuccess) {
        cell.classList.add("attacked");
        // add adjacent squares to our target queue
        addAdjacentTargets(x, y, board);
    } else {
        cell.classList.add("missed");
    }

    if (player.gameBoard.allSunk()) {
        order.textContent = "Computer wins!";
        
        return true;
    }
    return false;
}

function resetGame() {
    player1 = new Player(boardSize);
    player2 = new Player(boardSize);

    // clear target queue
    compTargets = [];

    createBoard();
    // reset placement counter
    shipPlaced = 0;
    
    createShipsUI();
    hidePassOverlay();
    ready = [false, false];
    play();
}

class Ship {
    constructor(length){
        this.length = length;
        this.numberOfHits = 0;
        this.isSunk = false;
    }

    hit(){
        this.numberOfHits++ ;
    }

    checkIfSunk(){
        this.isSunk = this.numberOfHits >= this.length ;

        return this.isSunk;
    }
}


class Gameboard{
    constructor(size){
        this.size = size;

        this.ships = [];

        this.grid = Array.from({length: size}, ()=>{
            return Array(size).fill(null);
        });

        this.missedAttacks = [];
    }

    placeShip(x, y, length, isHorizontal){
        // verify data validity

        let coords = [];
        for(let i=0; i<length; i++){
            let nx = (isHorizontal ? x + i: x);
            let ny = (isHorizontal ? y: y + i);

            // detect collisions and out of bounds
            if (this.grid[ny][nx] !== null) throw "Error, Collision";
            if (nx >= this.size || ny >= this.size) throw "Error, out of bounds";

            coords.push([nx, ny]);
        }

        let ship = new Ship(length);

        let shipIndex = this.ships.push({ship, coords}) - 1; // [ {ship1, [[0, 0], [1, 0], [2, 0]]} , {ship2, [[2, 3], [2, 4]]} , ...]

        // add to the grid
        coords.forEach((coords, index) =>{
            this.grid[coords[1]][coords[0]] = {shipIndex, index} ;
        })

        return true;
       
    }

    receiveAttack(x, y){
        // determine if it hits a ship
        if (!this.grid[y][x]) {
            this.missedAttacks.push([x, y]);

            return false
        }

        let {shipIndex} = this.grid[y][x];
        let {ship} = this.ships[shipIndex]; 
        ship.hit();

        return true
    }

    allSunk(){
        for (let {ship, coords} of this.ships){
            if (!ship.checkIfSunk()) return false;
        }
        return true;
    }
}


class Player {
    constructor(size){
        this.gameBoard = new Gameboard(size);
    }
}

export {Ship, Gameboard, Player} ;

//module.exports = {Ship, Gameboard, Player};

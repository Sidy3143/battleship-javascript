//const { Ship, Gameboard, Player } = require("./modules");
import { Ship, Gameboard, Player } from "./modules.js";

describe("Ship", () => {

  test("initializes with length and tracks hits", () => {
    const ship = new Ship(3);
    expect(ship.length).toBe(3);
    expect(ship.numberOfHits).toBe(0);
  });

  test("hit increments numberOfHits and isSunk becomes true after enough hits", () => {
    const ship = new Ship(2);
    ship.hit();
    expect(ship.numberOfHits).toBe(1);
    // after one more hit it should be sunk
    ship.hit();
    // API expected: ship.isSunk() returns true when sunk
    expect(ship.checkIfSunk()).toBeTruthy();
    expect(ship.isSunk).toBeTruthy();
  });
});

describe("Gameboard", () => {
  test("placeShip returns true when placing a horizontal ship in-bounds", () => {
    const board = new Gameboard(10);
    expect(board.placeShip(0, 0, 3, "horizontal")).toBe(true);
  });

  test("placeShip returns true when placing a vertical ship in-bounds", () => {
    const board = new Gameboard(10);
    expect(board.placeShip(2, 2, 4, "vertical")).toBe(true);
  });

  test("placing a ship that would go out of bounds throws", () => {
    const board = new Gameboard(5);
    expect(() => board.placeShip(4, 4, 3, "horizontal")).toThrow();
    expect(() => board.placeShip(4, 4, 3, "vertical")).toThrow();
  });

  test("placing overlapping ships throws (collision detection)", () => {
    const board = new Gameboard(10);
    expect(board.placeShip(0, 0, 3, "horizontal")).toBe(true);
    // overlapping at (1,0)
    expect(() => board.placeShip(1, 0, 2, "vertical")).toThrow();
  });

  test("receiveAttack records misses and hits appropriately", () => {
    const board = new Gameboard(10);
    board.placeShip(0, 0, 2, "horizontal"); // ship at (0,0) and (1,0)
    // miss
    expect(board.receiveAttack(5, 5)).toBe(false);
    expect(Array.isArray(board.missedAttacks)).toBe(true);
    expect(board.missedAttacks.some(coord => coord[0] === 5 && coord[1] === 5)).toBe(true);
    // hit
    expect(board.receiveAttack(0, 0)).toBe(true);
  });

  test("allSunk returns true only when every ship is sunk", () => {
    const board = new Gameboard(10);
    board.placeShip(0, 0, 2, "horizontal"); // ship A
    board.placeShip(2, 2, 1, "horizontal"); // ship B (length 1)
    // sink ship B
    board.receiveAttack(2, 2);
    // sink ship A with two hits
    board.receiveAttack(0, 0);
    board.receiveAttack(1, 0);
    // Expect allSunk to be a boolean (true when all sunk)
    expect(board.allSunk()).toBe(true);
  });
});

describe("Player", () => {
  test("player has a gameBoard instance", () => {
    const player = new Player();
    expect(player.gameBoard).toBeDefined();
    expect(typeof player.gameBoard.placeShip).toBe("function");
    expect(typeof player.gameBoard.receiveAttack).toBe("function");
  });
});
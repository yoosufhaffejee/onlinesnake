class snake{
    constructor(name, headCol, BodyCol, headX, headY, parts, tailLength, xVelocity, yVelocity, score){
        this.name=name;
        this.headCol=headCol;
        this.BodyCol=BodyCol;
        this.headX=headX;
        this.headY=headY;
        this.parts=parts;
        this.tailLength=tailLength;
        this.xVelocity=xVelocity;
        this.yVelocity=yVelocity;
        this.score=score;
    }
}

class snakePart{
    constructor(x, y){
        this.x=x;
        this.y=y;
    }
}

class food{
    constructor(col, x, y){
        this.col = col;
        this.x=x;
        this.y=y;
    }
}

const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const txtPause = document.getElementById("txtPause");

// Temp var to store the keys entered in popup
let keys = [];

// Settings
//General
let solidWalls = false;
let isPasued = false;
let sameTeam = false;
let TouchControls = false;
let speed = 12;
let canvasSize = 600;
//GameOver
let WinningScore = 25;
let gameOver=false;
//Players
let playerCount = 0;
//Controls
//2D Array
let buttonMappings = [];

canvas.width = canvasSize;
canvas.height = canvasSize;
let tileCount = canvasSize/24;
let tileSize=canvasSize/tileCount-2;

// Static list of available snakes
const allSnakes = [
    new snake("Player1", "orange", "green", 5, 10, [new snakePart(-5, -5)], 1, 0, 0, 0),
    new snake("Player2", "yellow", "blue", 15, 10, [new snakePart(-5, -5)], 1, 0, 0, 0),
    new snake("Player3", "purple", "lime", 5, 5, [new snakePart(-5, -5)], 1, 0, 0, 0),
    new snake("Player4", "pink", "cyan", 15, 5, [new snakePart(-5, -5)], 1, 0, 0, 0),
    new snake("Player5", "tan", "lavender", 10, 5, [new snakePart(-5, -5)], 1, 0, 0, 0),
    new snake("Player6", "#FF7F50", "#36454F", 10, 15, [new snakePart(-5, -5)], 1, 0, 0, 0),
    new snake("Player7", "#FFFDD0", "navy", 5, 15, [new snakePart(-5, -5)], 1, 0, 0, 0),
    new snake("Player8", "teal", "silver", 15, 15, [new snakePart(-5, -5)], 1, 0, 0, 0)
];

// A temp list of all snakes, data will be modified
let clonedSnakes = structuredClone(allSnakes);
// The list of player snakes in lobby that will start game (points to cloned snakes)
let playerSnakes = [];
// The list of alive snakes for gamestate updates
let aliveSnakes = [];

let apple = new food("red", -5, -5);

let started = false;
let AppleInitialized = false;
let GameOverText = false;

//***Firebase***//
let allPlayers = firebase.database().ref(`players`);
let myPlayerIndex = 0;
let playerId;
let player;
let Food;
// Runs of load
firebase.auth().onAuthStateChanged((user) => {
    console.log(user);
    if (user) {
      //You're logged in!
      playerId = user.uid;
      player = firebase.database().ref(`players/${playerId}`);
      Food = firebase.database().ref(`food`);

      // Checks how many players in lobby
      allPlayers.once("value", function(snapshot) {
        if(snapshot.exists())
        {
            // Sets your player number
            myPlayerIndex = snapshot.numChildren();
            addSnake();
        }
        else
        {
            // if no players you are snake 0
            myPlayerIndex = 0;
            addSnake();
        }
    });
      console.log(myPlayerIndex);
      
      //Remove me from Firebase when I diconnect
      player.onDisconnect().remove();

      //Begin the game now that we are signed in
      drawGame();
    } else {
      //You're logged out.
    }
  })

// Join Error
firebase.auth().signInAnonymously().catch((error) => {
    var errorCode = error.code;
    var errorMessage = error.message;
    // ...
    console.log(errorCode, errorMessage);
});
//***Firebase***//

function addSnake()
{
    if(playerCount >= 8)
    {
        alert("Max players allowed is 8");
    }
    else if(started === false && GameOverText === false)
    {
        // Add the player to the lobby
        playerSnakes.push(clonedSnakes[playerCount]);
        // Add the player to the game
        player.set(clonedSnakes[playerCount]);
        Food.set(apple);
    }
}

//Fires whenever a change occurs
allPlayers.on("value", (snapshot) => {
    let p = snapshot.val();
    let tempSnakes = [];

    // Set update the alivesnakes to db version
    Object.keys(p).forEach((key) => {
        tempSnakes.push(p[key]);
    })
    aliveSnakes = tempSnakes;
    playerCount = aliveSnakes.length;
    //setTimeout(drawGame, 10000/speed);
    //drawGame();
})

// create game loop-to continously update screen
function drawGame(){

    if(isPasued)
    {
        pause();
    }

    clearScreen();
    drawSnake();
    moveSnake();
    drawApple();
    checkCollision();
    drawScore();

    // game over logic
    let stop = isGameOver();
    if(stop === true){
        return;
    }
    setTimeout(drawGame, 1000/speed);// Faster speed, less timeout
    if(aliveSnakes[myPlayerIndex] != null)
    {
        player.set(aliveSnakes[myPlayerIndex]);
        //allPlayers.child(playerId).update(aliveSnakes[myPlayerIndex]);
    }
}

function reset()
{
    // Init and hide apple before game starts
    apple = new food("red", -5, -5);

    // Reset any unfinished key entries
    keys = [];

    // Set state
    started = false;
    AppleInitialized = false;
    // Hide text
    GameOverText = false;

    // Reset snakes to default
    clonedSnakes = structuredClone(allSnakes);

    // Get the number of players waiting to play before resetting
    let lobbyPlayerCount = playerSnakes.length;
    // Reset all players
    playerSnakes = [];
    // Only add the number of players waiting
    for (let index = 0; index < lobbyPlayerCount; index++) {
        playerSnakes.push(clonedSnakes[index]);
    }
    aliveSnakes = playerSnakes.slice();
}

function pause()
{
    aliveSnakes.forEach(snake => {
        snake.xVelocity = 0;
        snake.yVelocity = 0;
    });

    txtPause.hidden = false;
}

//Game Over function
function isGameOver(){

    gameOver = false;

    aliveSnakes.forEach(snake => {

        //check whether game has started
        if (snake.yVelocity === 0 && snake.xVelocity === 0) {
            return false;
        }

        if(started === false)
        {
            var countMovingPlayers = 0;
            aliveSnakes.forEach(snake => {
                // only draw apple once game has started and both players moving
                if (snake.yVelocity !== 0 || snake.xVelocity !== 0) {
                    countMovingPlayers++;
                }
            });

            if(countMovingPlayers === aliveSnakes.length)
            {
                started = true;
            }
        }

        let otherSnakes = aliveSnakes.slice();
        let snakeIndex = aliveSnakes.indexOf(snake);
        otherSnakes.splice(snakeIndex, 1);

        otherSnakes.forEach(otherSnake => {
            // Game ends if snakes' heads clash
            if((snake.headX === otherSnake.headX && snake.headY === otherSnake.headY) && started)
            {
                // if last 2 snakes collide
                if(aliveSnakes.length <= 2)
                {
                    // Check who won before removing
                    displayGameOverText(aliveSnakes);
                }

                // Kill the snakes that collided
                let index = aliveSnakes.indexOf(snake);
                aliveSnakes.splice(index, 1);

                index = aliveSnakes.indexOf(otherSnake);
                aliveSnakes.splice(index, 1);

                // End game if 1 or less snakes left
                if(aliveSnakes.length <= 1)
                {
                    gameOver = true;

                    // Restart after few seconds
                    if(isTouchDevice())
                    {
                        setTimeout(x => {
                            reset();
                            drawGame();
                        }, 5000);
                    }
                }
            }
        });

        if(snake.score >= WinningScore)
        {
            gameOver=true;

            // Restart after few seconds
            if(isTouchDevice())
            {
                setTimeout(x => {
                    reset();
                    drawGame();
                }, 5000);
            }
        }

        if(solidWalls==true)
        {
            wallCollision(snake);
        }
        else
        {
            wallTeleport(snake);
        }

        CheckBodyColission(snake, gameOver);
    });

    //display text Game Over
    if(gameOver && !GameOverText){
        displayGameOverText(aliveSnakes);
    }

    // this will stop execution of drawgame method
    return gameOver;
}

function CheckBodyColission(snake)
{
    //stop game when snake crush to its own body
    for(let i=0; i<snake.parts.length;i++){
        let part=snake.parts[i];
        if(part.x===snake.headX && part.y===snake.headY){//check whether any part of snake is occupying the same space
            if(playerCount === 1)
            {
                gameOver=true;

                // Restart after few seconds
                if(isTouchDevice())
                {
                    setTimeout(x => {
                        reset();
                        drawGame();
                    }, 5000);
                }

                return;
            }
            let penalty = snake.parts.length - i - 1;
            snake.parts.splice(snake.parts[i], penalty);
            snake.tailLength-=penalty;
            snake.score-= penalty;
            break; // to break out of for loop
        }
    } 
}

function displayGameOverText(aliveSnakes)
{
    GameOverText = true;

    // Game Over Text
    ctx.fillStyle="white";
    ctx.font="50px verdana";
    ctx.fillText("Game Over!", canvas.width/6.5, canvas.height/2);

    if(playerSnakes.length === 1)
    {
        ctx.fillStyle=aliveSnakes[0].headCol;
    	ctx.font="36px verdana";
    	ctx.fillText("Score: " + aliveSnakes[0].score, canvas.width/5.5, canvas.height/2 + 50);
        return;
    }

    if(aliveSnakes.length === 1)
    {
        ctx.fillStyle=aliveSnakes[0].headCol;
    	ctx.font="36px verdana";
    	ctx.fillText(aliveSnakes[0].name + "Wins!", canvas.width/5.5, canvas.height/2 + 50);
        return;
    }

    // Winner Text
    let winner;
    let highestScore = 0;

    let count = 0;
    aliveSnakes.forEach(snake => {
        if(snake.score !== count)
        {
            count++;
        }
    });

    // Draw since all snakes have the same score (if 0 or 1)
    if(count < 1)
    {
        ctx.fillStyle="white";
    	ctx.font="36px verdana";
    	ctx.fillText("Draw!", canvas.width/2.5, canvas.height/2 + 50);
        
        gameOver = true;
    }
    // TODO: This will return only 1 winner even if multiple exist
    else
    {
        aliveSnakes.forEach(snake => {
            if(snake.score >= highestScore)
            {
                highestScore = snake.score;
                winner = snake;
            }
        });

        ctx.fillStyle=winner.headCol;
    	ctx.font="36px verdana";
    	ctx.fillText(winner.name + " Wins", canvas.width/5.5, canvas.height/2 + 50);
    }
}

function wallCollision(snake)
{
    if(snake.headX<0){//if snake hits left wall
        gameOver=true;
    }
    else if(snake.headX===tileCount){//if snake hits right wall
        gameOver=true;
    }
    else if(snake.headY<0){//if snake hits wall at the top
        gameOver=true;
    }
    else if(snake.headY===tileCount){//if snake hits wall at the bottom
        gameOver=true;
    }

    // Restart after few seconds
    if(gameOver === true && isTouchDevice())
    {
        setTimeout(x => {
            reset();
            drawGame();
        }, 5000);
    }
}

function wallTeleport(snake)
{
    if(snake.headX<0){//if snake hits left wall
        snake.headX=tileCount-1;
    }
    else if(snake.headX===tileCount-1){//if snake hits right wall
        snake.headX=0;
    }
    else if(snake.headY<0){//if snake hits wall at the top
        snake.headY=tileCount-1;
    }
    else if(snake.headY===tileCount-1){//if snake hits wall at the bottom
        snake.headY=0;
    }
}

// score function
function drawScore(){
    aliveSnakes.forEach(snake => {
        ctx.fillStyle = snake.headCol;
        ctx.font = "12px verdena";
    
        if(snake.name.includes("1"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize*3/100, 10);
        }
    
        if(snake.name.includes("2"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize*30/100, 10); // 30%
        }
    
        if(snake.name.includes("3"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize*60/100, 10); // 60%
        }
    
        if(snake.name.includes("4"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize-65, 10);
        }

        if(snake.name.includes("5"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize*3/100, canvasSize - 10);
        }
    
        if(snake.name.includes("6"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize*30/100, canvasSize - 10); // 30%
        }
    
        if(snake.name.includes("7"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize*60/100, canvasSize - 10); // 60%
        }
    
        if(snake.name.includes("8"))
        {
            ctx.fillText(snake.name + " : " + snake.score, canvasSize-65, canvasSize - 10);
        }
    });
}

// clear our screen
 function clearScreen(){
    // make screen black
    ctx.fillStyle= 'black';
    // black color start from 0px left, right to canvas width and canvas height
    ctx.fillRect(0, 0, canvas.width, canvas.height);
 }
 
 function drawSnake(){
    aliveSnakes.forEach(snake => {
        ctx.fillStyle=snake.BodyCol;
    
        //loop through our snakeparts array
        for(let i=0;i<snake.parts.length;i++){
            //draw snake parts
            let part=snake.parts[i]
             ctx.fillRect(part.x *tileCount, part.y *tileCount, tileSize,tileSize)
        }
        
        //add parts to snake --through push
        snake.parts.push(new snakePart(snake.headX,snake.headY));//put item at the end of list next to the head
        
        if(snake.parts.length>snake.tailLength){
            snake.parts.shift();//remove furthest item from  snake part if we have more than our tail size
        }
    
        ctx.fillStyle=snake.headCol;
        ctx.fillRect(snake.headX* tileCount,snake.headY* tileCount, tileSize,tileSize)
    });
 }
 
 function moveSnake(){
    aliveSnakes.forEach(snake => {
        snake.headX=snake.headX + snake.xVelocity;
        snake.headY=snake.headY+ snake.yVelocity;
    });
 }
 
 function drawApple(){
    if(started === true && AppleInitialized === false)
    {
        apple = new food("red", randomPosition(), randomPosition());
        AppleInitialized = true;
        Food.set(apple);
    }
    
    ctx.fillStyle= apple.col;
    ctx.fillRect(apple.x*tileCount, apple.y*tileCount, tileSize, tileSize)
 }
 
 function randomPosition()
 {
    return Math.floor(Math.random()*(tileCount-2));
 }

 // check for collision and change apple position
 function checkCollision(){
    Food.once("value", (snapshot) => {
        apple = snapshot.val();
        aliveSnakes.forEach(snake => {
            if(apple.x==snake.headX && apple.y==snake.headY){
                apple.x=randomPosition();
                apple.y=randomPosition();
                console.log("apple", apple.x, apple.y);
                snake.tailLength++;
                snake.score++; //increase our score value
                console.log(aliveSnakes);
                Food.set(apple);
            }
        });
    });
 }
 
 //add event listener to our body
 document.body.addEventListener('keydown', keyDown);

function keyDown()
{
    // Enter to Reset Game
    if(event.keyCode==13)
    {
        event.preventDefault();
        reset();

        if(gameOver === true)
        {
            drawGame();
        }
    }

    // Esc to Pause Game
    if(event.keyCode==27)
    {
        txtPause.hidden = true;
        return isPasued = !isPasued;
    }

    if(isPasued)
    {
        return;
    }

    //WASD
    // W - up
    if(event.keyCode==87){
    	moveUp(aliveSnakes[myPlayerIndex]);
    }
    
    // A - left
    if(event.keyCode==65){
    	moveLeft(aliveSnakes[myPlayerIndex]);
    }

	// S - down
    if(event.keyCode==83){
    	moveDown(aliveSnakes[myPlayerIndex]);
    }
    
    // D - right
    if(event.keyCode==68){
    	moveRight(aliveSnakes[myPlayerIndex]);
    }

    player.set(aliveSnakes[myPlayerIndex]);
}

function moveUp(snake)
{
	if(snake.yVelocity==1)
        return;
        snake.yVelocity=-1;
        snake.xVelocity=0;
}

function moveDown(snake)
{
	if(snake.yVelocity==-1)
        return;
        snake.yVelocity=1;
        snake.xVelocity=0;
}

function moveRight(snake)
{
	if(snake.xVelocity==-1)
        return;
        snake.yVelocity=0;
        snake.xVelocity=1;
}

function moveLeft(snake)
{
	if(snake.xVelocity==1)
        return;
        snake.yVelocity=0;
        snake.xVelocity=-1;
}

document.addEventListener('touchstart', handleTouchStart, false);        
document.addEventListener('touchmove', handleTouchMove, false);

// Touch
function isTouchDevice() {
    return (('ontouchstart' in window) ||
       (navigator.maxTouchPoints > 0) ||
       (navigator.msMaxTouchPoints > 0));
}

var xDown = null;                                                        
var yDown = null;

function getTouches(evt) {
  return evt.touches || evt.originalEvent.touches; // jQuery
}

function handleTouchStart(evt) {
    const firstTouch = getTouches(evt)[0];                                      
    xDown = firstTouch.clientX;                                      
    yDown = firstTouch.clientY;                                      
};

function handleTouchMove(evt) {
    if (!xDown || !yDown) {
        return;
    }

    var xUp = evt.touches[0].clientX;
    var yUp = evt.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {/*most significant*/
        if (xDiff > 0) {
            moveLeft(aliveSnakes[myPlayerIndex]);
        } else {
            moveRight(aliveSnakes[myPlayerIndex]);
        }
    } else {
        if (yDiff > 0) {
            moveUp(aliveSnakes[myPlayerIndex]);
        } else {
            moveDown(aliveSnakes[myPlayerIndex]);
        }
    }
    /* reset values */
    xDown = null;
    yDown = null;
    player.set(aliveSnakes[myPlayerIndex]);
};

 //drawGame(); 

////////////////////////////////////////////////////////////////////////////////////////////////
//       _____ _____  ___   _   __   _   _______ _     ______ _____ _____ _   _  _____        //
//      |_   _/  ___|/ _ \ | | / /  | | / /  _  | |    | ___ \  ___|_   _| \ | |/  ___|       //
//        | | \ `--./ /_\ \| |/ /   | |/ /| | | | |    | |_/ / |__   | | |  \| |\ `--.        //
//        | |  `--. \  _  ||    \   |    \| | | | |    | ___ \  __|  | | | . ` | `--. \       //
//       _| |_/\__/ / | | || |\  \  | |\  \ \_/ / |____| |_/ / |___ _| |_| |\  |/\__/ /       //
//       \___/\____/\_| |_/\_| \_/  \_| \_/\___/\_____/\____/\____/ \___/\_| \_/\____/        //
//                                                                                            //
//      Isak Arnar Kolbeins                                                                   //
//                                                                                            //
//      Verkefni 3, Tolvugrafik 2019                                                          //
//                                                                                            //
//      Trisis 3D, einfölduð þrívíddar útgáfa af tetris                                       //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////

var canvas;
var gl;

var movement = false; // Mouse click drag
var spinX = 0;
var spinY = 0;
var origX;
var origY;

var boxSize = 6;

var zView = boxSize * 3; // viewer z position

var proLoc;
var mvLoc;
var colorLoc;

// Number of points for each object
var Numfill = points.boxFill.length;
var Numframe = points.boxFrame.length;

// The points in 3d space -- in vertices file
var vertices = points.boxFill.concat(points.boxFrame);

var keys = {};
var currTrisis;
var nextTrisis;
var updateTimer = true;
var dropTimer = true;
var isPaused = true;
var started = false;
var dropspeed = 1000;
var bombBlocks;

var grid = Array.from(Array(20), _ => Array.from(Array(6), _ => Array(6).fill(0))); // [20[6[6]]] -- [y[z[x]]]

// Grid ----- test okok
/* grid[0].forEach((_, x) => _.forEach((_, z) => (grid[0][x][z] = 5)));
grid[0].forEach((_, x) => _.forEach((_, z) => (grid[1][x][z] = 5)));
grid[0][3][3] = 0;
grid[1][3][3] = 0; */

var colors = [
  vec4(0.8, 0.0, 0.0, 0.5),
  vec4(0.8, 0.0, 0.0, 0.5),
  vec4(0.0, 0.8, 0.0, 0.5),
  vec4(0.0, 0.0, 0.8, 0.5),
  vec4(0.8, 0.0, 0.8, 0.5),
  vec4(0.8, 0.8, 0.0, 0.5),
  vec4(0.0, 0.8, 0.8, 0.5)
];

window.onload = function init() {
  canvas = document.getElementById('gl-canvas');

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL isn't available");
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.enable(gl.CULL_FACE);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  //  Load shaders and initialize attribute buffers
  var program = initShaders(gl, 'vertex-shader', 'fragment-shader');
  gl.useProgram(program);

  var vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

  var vPosition = gl.getAttribLocation(program, 'vPosition');
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);

  colorLoc = gl.getUniformLocation(program, 'fColor');
  proLoc = gl.getUniformLocation(program, 'projection');
  mvLoc = gl.getUniformLocation(program, 'modelview');

  // Projection array for viewer
  var proj = perspective(90.0, 1.0, 0.1, 100.0);
  gl.uniformMatrix4fv(proLoc, false, flatten(proj));

  // Create first element
  nextTrisis = newTrisis();

  // Mouse handlers
  canvas.addEventListener('mousedown', function(e) {
    movement = true;
    origX = e.offsetX;
    origY = e.offsetY;
    //e.preventDefault(); // Disable drag and drop
  });

  canvas.addEventListener('touchstart', function(e) {
    movement = true;
    origX = e.clientX || e.targetTouches[0].pageX;
    origY = e.clientY || e.targetTouches[0].pageY;
    e.preventDefault(); // Disable drag and drop
  });

  canvas.addEventListener('mouseup', function(e) {
    movement = false;
  });
  canvas.addEventListener('touchend', function(e) {
    movement = false;
  });

  canvas.addEventListener('mousemove', function(e) {
    if (movement) {
      spinY += (e.offsetX - origX) % 360;
      spinX += (e.offsetY - origY) % 360;
      origX = e.offsetX;
      origY = e.offsetY;
    }
  });
  canvas.addEventListener('touchmove', function(e) {
    if (movement) {
      var currx = e.clientX || e.targetTouches[0].pageX;
      var curry = e.clientY || e.targetTouches[0].pageY;
      spinY += (currx - origX) % 360;
      spinX += (curry - origY) % 360;
      origX = currx;
      origY = curry;
    }
  });

  // Keyboard functions
  window.addEventListener('keydown', function(e) {
    e = e || event;
    keys[e.keyCode] = e.type == 'keydown';
    if (keys[13] && !started) {
      startGame();
    } // Enter - start game
    if (keys[80]) {
      isPaused = !isPaused;
    } // p Key - toggle pause
    if (document.activeElement === canvas){
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', function(e) {
    e = e || event;
    keys[e.keyCode] = e.type == 'keydown';
  });

  // Scroll wheel handler
  window.addEventListener('mousewheel', function(e) {
    if (document.activeElement === canvas){
      if (e.wheelDelta > 0.0) {
        zView += 0.2;
      } else {
        zView -= 0.2;
      }
      e.preventDefault();
    }
  });

  setInterval(function() { updateTimer = true; }, 100);
  setInterval(function() { dropTimer = true; }, dropspeed);

  render();
};

function objClone(src) {
  return JSON.parse(JSON.stringify(src));
}

function sidemovement(t) {
  if (keys[37]) { moveTrisis(t, 'x', -1); }     // Left arrow   - move -X direction
  if (keys[38]) { moveTrisis(t, 'z', -1); }     // Up arrow     - move -Z direction
  if (keys[39]) { moveTrisis(t, 'x', 1); }      // Right arrow  - move X direction
  if (keys[40]) { moveTrisis(t, 'z', 1); }      // Down arrow   - move Z direction
  
  if (keys[65]) { rotateTrisis(t, ['y','z']); } // A Key    - rotate over X - cw
  if (keys[90]) { rotateTrisis(t, ['z','y']); } // Z Key    - rotate over X - C.cw
  if (keys[83]) { rotateTrisis(t, ['x','z']); } // S Key    - rotate over Y - cw
  if (keys[88]) { rotateTrisis(t, ['z','x']); } // X Key    - rotate over Y - C.cw
  if (keys[68]) { rotateTrisis(t, ['x','y']); } // D Key    - rotate over Z - cw
  if (keys[67]) { rotateTrisis(t, ['y','x']); } // C Key    - rotate over Z - C.cw

  return t;
}

function startGame() {
  reset();
  started = true;
  isPaused = false;
  setOfNextTrisis();
}

function reset() {
  isPaused=true;
  started=false;
  document.getElementById("currScore").innerHTML = 0;
  grid = Array.from(Array(20), _ => Array.from(Array(6), _ => Array(6).fill(0))); // [20[6[6]]] -- [y[z[x]]]
}

function setOfNextTrisis() {
  currTrisis = nextTrisis;
  nextTrisis = newTrisis();
  return currTrisis;
}

// prettier-ignore
function downmovement(t) {
  if (keys[32]) { t = moveTrisis(t, 'y', -1); }     // Space
  if (dropTimer) { 
    t = moveTrisis(t, 'y', -1);
    dropTimer = false;
  }
  return t;
}

function newTrisis() {
  var center, other, third;
  var randX = Math.floor(Math.random() * 2) + 2;
  var randZ = Math.floor(Math.random() * 2) + 2;
  var color = Math.floor(Math.random() * 6) + 1;
  if (Math.random() < 0.5) {
    center = {x: randX, y: 21, z: randZ};
    other = {x: randX, y: 22, z: randZ};
    third = {x: randX, y: 20, z: randZ};
  } else {
    center = {x: randX, y: 20, z: randZ};
    other = {x: randX, y: 21, z: randZ};
    third = {x: randX + 1, y: 20, z: randZ};
  }

  var trisis = {center, other, third, color};

  if (Math.random() > 0.5) {
    rotateTrisis(trisis, ['x', 'y']);
  }
  if (Math.random() > 0.5) {
    rotateTrisis(trisis, ['z', 'y']);
  }
  if (Math.random() > 0.5) {
    rotateTrisis(trisis, ['x', 'z']);
  }

  return trisis;
}

function moveTrisis(t, axis, num) {
  t.center[axis] += num;
  t.other[axis] += num;
  t.third[axis] += num;
  return t;
}

function blockAllocationForRotation(C, B, extra) {
  if (C[extra[0]] !== B[extra[0]] || C[extra[1]] !== B[extra[1]]) {
    if (C[extra[0]] > B[extra[0]]) {
      B[extra[0]] += 1;
      B[extra[1]] += 1;
    } else if (C[extra[0]] < B[extra[0]]) {
      B[extra[0]] -= 1;
      B[extra[1]] -= 1;
    } else if (C[extra[1]] > B[extra[1]]) {
      B[extra[0]] -= 1;
      B[extra[1]] += 1;
    } else if (C[extra[1]] < B[extra[1]]) {
      B[extra[0]] += 1;
      B[extra[1]] -= 1;
    }
  }
}

function rotateTrisis(t, extra) {
  blockAllocationForRotation(t.center, t.other, extra);
  blockAllocationForRotation(t.center, t.third, extra);
}

//prettier-ignore
function sidesCollide(t) {
  if (  (t.center.x > 5 || t.center.x < 0 )||(t.center.z > 5 || t.center.z < 0) ||
        (t.other.x > 5 || t.other.x < 0) ||(t.other.z > 5 || t.other.z < 0) ||
        (t.third.x > 5 || t.third.x < 0) ||(t.third.z > 5 || t.third.z < 0) ) {
    return true;
  }
  if (t.center.y < 20 && t.other.y < 20 && t.third.y < 20) {
    if (grid[t.center.y][t.center.x][t.center.z] !== 0) { return true; }
    if (grid[t.other.y][t.other.x][t.other.z] !== 0) { return true;}
    if (grid[t.third.y][t.third.x][t.third.z] !== 0) { return true;}
  }
  return false;
}

//prettier-ignore
function downCollide(t) {
    if (t.center.y < 0 || t.other.y < 0 || t.third.y < 0) { return true; }
    if (t.center.y < 20 && t.other.y < 20 && t.third.y < 20) {
        if (grid[t.center.y][t.center.x][t.center.z] !== 0) { return true; }
        if (grid[t.other.y][t.other.x][t.other.z] !== 0) { return true;}
        if (grid[t.third.y][t.third.x][t.third.z] !== 0) { return true;}
    }
    return false;
}

function updateTrisis(curr) {
  var next = objClone(curr);

  if (updateTimer) {
    next = sidemovement(next);
    updateTimer = false;
  }
  if (sidesCollide(next)) {
    next = objClone(curr);
  }

  if (!isPaused) {
    next = downmovement(next);
  }

  if (downCollide(next)) {
    if (curr.center.y > 19 || curr.other.y > 19 || curr.third.y > 19) {
      // Game over -            -----
      window.alert('Game over \n'+'Final score: '+ document.getElementById("currScore").innerHTML);
      reset();
    }
    else {
      grid[curr.center.y][curr.center.x][curr.center.z] = curr.color;
      grid[curr.other.y][curr.other.x][curr.other.z] = curr.color;
      grid[curr.third.y][curr.third.x][curr.third.z] = curr.color;
    }
      
    checkForFullPlane();
    next = setOfNextTrisis();
  }
  return next;
}

function colorBomb(levels) {
  var colTime = 200;
  var c = 0;
  var intervalID = setInterval(function() {
    levels.forEach(y =>
      grid[y].forEach((_, x) => _.forEach((_, z) => (grid[y][x][z] = c)))
    );
    if (++c === 7) {
      window.clearInterval(intervalID);
    }
  }, colTime);
  setTimeout(() => {
    for (var i = levels.length - 1; i >= 0; i--) {
      grid.splice(levels[i], 1);
      grid.push(Array.from(Array(6), _ => Array(6).fill(0)));
    }
    // Bomb ??
  }, 7 * colTime);
}

function checkForFullPlane() {
  var completed = [];
  grid.forEach((plane, y) => {
    if (plane.every(_ => _.every(curr => curr !== 0))) {
      completed.push(y);
    }
  });

  if (completed.length > 0) {
    colorBomb(completed);
    addScore(completed.length);
  }
}

function addScore(planes) {
  var currScore = parseInt(document.getElementById("currScore").innerHTML);
  document.getElementById("currScore").innerHTML = currScore+planes*36;
}

function drawFrame(mv, pos) {
  mv = mult(mv, translate(pos.x * 2 - 5, pos.y * 2 - 19, pos.z * 2 - 5));
  // white frame arond the block
  gl.uniform4fv(colorLoc, vec4(0.5, 0.5, 0.5, 1.0));
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.LINE_STRIP, Numfill, Numframe);
}

function drawBox(mv, pos, color) {
  mv = mult(mv, translate(pos.x * 2 - 5, pos.y * 2 - 19, pos.z * 2 - 5));
  // Half transparent glass container, only draw inside
  gl.uniform4fv(colorLoc, color);
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.TRIANGLES, 0, Numfill);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var mv = lookAt(
    vec3(0.0, 0.0, zView),
    vec3(0.0, 0.0, 0.0),
    vec3(0.0, 1.0, 0.0)
  );
  mv = mult(mv, rotateX(spinX));
  mv = mult(mv, rotateY(spinY));
  gl.cullFace(gl.FRONT); // outside

  mv = mult(mv, scalem(boxSize / 10, boxSize / 10, boxSize / 10));

  // update the postitions
  if (!isPaused) {
    currTrisis = updateTrisis(currTrisis);
  }

  if (started) {
    drawFrame(mv, currTrisis.center);
    drawFrame(mv, currTrisis.other);
    drawFrame(mv, currTrisis.third);
  }

  drawFrame(mv, nextTrisis.center);
  drawFrame(mv, nextTrisis.other);
  drawFrame(mv, nextTrisis.third);

  grid.forEach((_, y) =>
    _.forEach((_, x) =>
      _.forEach((curr, z) => {
        if (curr !== 0) {
          drawFrame(mv, {x, y, z}, colors[curr]);
        }
      })
    )
  );

  if (started) {
    drawBox(mv, currTrisis.center, colors[currTrisis.color]);
    drawBox(mv, currTrisis.other, colors[currTrisis.color]);
    drawBox(mv, currTrisis.third, colors[currTrisis.color]);
  }

  grid.forEach((_, y) =>
    _.forEach((_, x) =>
      _.forEach((curr, z) => {
        if (curr !== 0) {
          drawBox(mv, {x, y, z}, colors[curr]);
        }
      })
    )
  );

  mv = mult(mv, scalem(10 / boxSize, 10 / boxSize, 10 / boxSize));
  // Scale for platform
  mv = mult(
    mv,
    scalem(boxSize * 0.6 + 0.1, boxSize * 2 + 0.1, boxSize * 0.6 + 0.1)
  );

  gl.cullFace(gl.FRONT); // Inside

  //  Draw the platform
  gl.uniform4fv(colorLoc, vec4(1.0, 1.0, 1.0, 1.0));
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.LINE_STRIP, Numfill, Numframe);

  // Half transparent glass container, only draw inside
  gl.uniform4fv(colorLoc, vec4(0.1, 0.1, 0.1, 0.001));
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.TRIANGLES, 0, Numfill);

  // Reverse
  // mv = mult(mv, scalem(1 / boxSize, 1 / boxSize, 1 / boxSize));

  requestAnimFrame(render);
}

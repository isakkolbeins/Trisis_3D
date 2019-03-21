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
var updateTimer = true;
var dropTimer = true;

var grid = Array.from(Array(20), _ =>
  Array.from(Array(6), _ => Array(6).fill(0))
); // [20[6[6]]] -- [y[z[x]]]

var colors = [
  vec4(0.8, 0.0, 0.0, 0.001),
  vec4(0.8, 0.0, 0.0, 0.001),
  vec4(0.0, 0.8, 0.0, 0.001),
  vec4(0.0, 0.0, 0.8, 0.001),
  vec4(0.8, 0.0, 0.8, 0.001),
  vec4(0.8, 0.8, 0.0, 0.001),
  vec4(0.0, 0.8, 0.8, 0.001)
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

  currTrisis = newTrisis();

  grid[0][0][0] = 1;
  grid[6][3][4] = 6;
  grid[1][1][1] = 1;

  // Mouse handlers
  canvas.addEventListener('mousedown', function(e) {
    movement = true;
    origX = e.offsetX;
    origY = e.offsetY;
    e.preventDefault(); // Disable drag and drop
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
  });
  window.addEventListener('keyup', function(e) {
    e = e || event;
    keys[e.keyCode] = e.type == 'keydown';
  });

  // Scroll wheel handler
  window.addEventListener('mousewheel', function(e) {
    if (e.wheelDelta > 0.0) {
      zView += 0.2;
    } else {
      zView -= 0.2;
    }
  });

  // prettier-ignore
  setInterval(function() { updateTimer = true; }, 100);
  // prettier-ignore
  setInterval(function() { dropTimer = true;   }, 1000);

  render();
};

function objCopy(obj) {
  let target = {};
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      target[prop] = obj[prop];
    }
  }
  return target;
}

function jsonCopy(src) {
  return JSON.parse(JSON.stringify(src));
}

// prettier-ignore
function sidemovement(t) {
  if (keys[37]) { t = moveTrisis(t, 'x', -1); }     // Left arrow
  if (keys[38]) { t = moveTrisis(t, 'z', -1); }     // Up arrow
  if (keys[39]) { t = moveTrisis(t, 'x', 1); }      // Right arrow
  if (keys[40]) { t = moveTrisis(t, 'z', 1); }      // Down arrow
  
  
  if (keys[65]) { t = rotateTrisis(t, 'x', 1); }    // A Key
  if (keys[90]) { t = rotateTrisis(t, 'x', -1); }   // Z Key
  // S Key
  if (keys[83]) {
  } // X Key
  if (keys[88]) {
  } // D Key
  if (keys[68]) {
  } // C Key
  if (keys[67]) {
  }
  return t;
}

function downmovement(t) {
  // Space
  if (keys[32]) {
    t = moveTrisis(t, 'y', -1);
  }
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
  if (Math.random() < 0.5) {
    center = {x: randX, y: 21, z: randZ};
    other = {x: randX, y: 22, z: randZ};
    third = {x: randX, y: 20, z: randZ};
  } else {
    center = {x: randX, y: 20, z: randZ};
    other = {x: randX, y: 21, z: randZ};
    third = {x: randX + 1, y: 20, z: randZ};
  }

  return (trisis = {
    center,
    other,
    third,
    color: Math.floor(Math.random() * 6) + 1
  });
}

function moveTrisis(t, axis, num) {
  t.center[axis] += num;
  t.other[axis] += num;
  t.third[axis] += num;
  return t;
}

function rotateTrisis(t, axis, dir) {}

//prettier-ignore
function sidesCollide(t) {
  if (  (t.center.x > 5 || t.center.x < 0 )||(t.center.z > 5 || t.center.z < 0) ||
        (t.other.x > 5 || t.other.x < 0) ||(t.other.z > 5 || t.other.z < 0) ||
        (t.third.x > 5 || t.third.x < 0) ||(t.third.z > 5 || t.third.z < 0) ) {
    return true;
  }
  if (t.center.y < 20 && t.other.y < 20 && t.third.y < 20) {
      console.log(t)
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
  var next = jsonCopy(curr);

  if (updateTimer) {
    next = sidemovement(next);
    updateTimer = false;
  }
  if (sidesCollide(next)) {
    next = jsonCopy(curr);
  }

  next = downmovement(next);

  if (downCollide(next)) {
    if (curr.center.y > 19 || curr.other.y > 19 || curr.third.y > 19) {
      // Game over -            -----
      window.alert('Game over');
    }
    grid[curr.center.y][curr.center.x][curr.center.z] = curr.color;
    grid[curr.other.y][curr.other.x][curr.other.z] = curr.color;
    grid[curr.third.y][curr.third.x][curr.third.z] = curr.color;
    // ---- Add score

    next = newTrisis();
  }
  return next;
}

function drawBox(mv, pos, color) {
  mv = mult(mv, translate(pos.x * 2 - 5, pos.y * 2 - 19, pos.z * 2 - 5));

  gl.uniform4fv(colorLoc, vec4(1.0, 1.0, 1.0, 1.0));
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.LINE_STRIP, Numfill, Numframe);

  // Half transparent glass container, only draw inside
  gl.uniform4fv(colorLoc, color);
  gl.uniformMatrix4fv(mvLoc, false, flatten(mv));
  gl.drawArrays(gl.TRIANGLES, 0, Numfill);

  //mv = mult(mv, scalem(10 / boxSize, 10 / boxSize, 10 / boxSize));
  return mv;
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

  currTrisis = updateTrisis(currTrisis);

  drawBox(mv, currTrisis.center, colors[currTrisis.color]);
  drawBox(mv, currTrisis.other, colors[currTrisis.color]);
  drawBox(mv, currTrisis.third, colors[currTrisis.color]);

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
  mv = mult(mv, scalem(1 / boxSize, 1 / boxSize, 1 / boxSize));

  requestAnimFrame(render);
}

var init = function() {
  useThreads = document.getElementById("worker").checked;
  test()
}

function test() {
  var g = ground.newGround("Test 1", p1);
  var name = "Test 1";
  var self = this;
  setTimeout(function() {
    console.log('time in')
      ground.drawPoints(g);
      var opts = {
        points: g.allPoints,
        t0: 1,
        g: 0.99,
        stepsPerT: 10
      }
      var listener = {
        ctx: g,
        name: name,
        onNewMin: function(p) {
        },
        onDone: function(p) {
          ground.clear(this.ctx);
          ground.drawPath(this.ctx, p1);
          ground.drawPoints(this.ctx);
        }
      };
      var a;
      console.log(useThreads)
      if (useThreads) {
          var worker = new Worker("http://apirocks.com/html5/src/webworkers/Worker.js");
          worker.onmessage = function(event) {
            console.log('nenenene')
              var msg = event.data[0];
              var p = event.data[1];
              listener[msg](p);
          };
          worker.onerror = function(event) {
              // console.log("WORKER ERROR");
          };

          worker.postMessage(["init", {
                  opts: opts,
                  width: 200,
                  height: 200
                }]);


          worker.postMessage(["go"]);
        
      }
      else {
        
      }
        // a = new Annealing();
      // a.init(opts, 200, 200, listener);
      // a.go();
    
  }, 10);  
}


var ground = {
  clear: function(ctx) {
    ctx.clearRect(0, 0, 200, 200);
  },
  drawPath: function(ctx, path) {
    ctx.strokeStyle = "green";
    ctx.fillStyle = "rgba(236, 138, 4, 0.5)";
    ctx.strokeWidth = 3;
    ctx.beginPath();
    var firstPoint = true;
    var l = ctx.allPoints.length;
    for (var i = 0; i < l; i++) {
      var idx = path[i];
      var x = ctx.allPoints[idx].x;
      var y = ctx.allPoints[idx].y;
      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  },
  drawPoints: function(ctx) {
    ctx.fillStyle = "red";
    for (var i = 0; i < ctx.allPoints.length; i++) {
      ctx.fillCircle(ctx.allPoints[i].x, ctx.allPoints[i].y, 6);
    }
  },
  newGround: function(name, points) {
    // var h2 = document.createElement("h2");
    // h2.appendChild(document.createTextNode(name));

    var canvas = document.createElement("canvas");
    canvas.setAttribute("width", "100");
    canvas.setAttribute("height", "100");

    var div = document.createElement("div");
    // div.appendChild(h2);
    div.appendChild(canvas);

    var container = document.getElementById("groundContainer");
    container.innerHTML = '';
    container.appendChild(div);
    var ctx = canvas.getContext("2d");
    ctx.scale(0.5,0.5);
    ctx.allPoints = points;

    return ctx;
  }
};

// http://webreflection.blogspot.com/2009/01/ellipse-and-circle-for-canvas-2d.html
(function(){
  // Andrea Giammarchi - Mit Style License
  var extend = {
    // Circle methods
    circle:function(aX, aY, aDiameter){
      this.ellipse(aX, aY, aDiameter, aDiameter);
    },
    fillCircle:function(aX, aY, aDiameter){
      this.beginPath();
      this.circle(aX, aY, aDiameter);
      this.fill();
    },
    strokeCircle:function(aX, aY, aDiameter){
      this.beginPath();
      this.circle(aX, aY, aDiameter);
      this.stroke();
    },
    // Ellipse methods
    ellipse:function(aX, aY, aWidth, aHeight){
      aX -= aWidth / 2;
      aY -= aHeight / 2;
      var hB = (aWidth / 2) * .5522848,
      vB = (aHeight / 2) * .5522848,
      eX = aX + aWidth,
      eY = aY + aHeight,
      mX = aX + aWidth / 2,
      mY = aY + aHeight / 2;
      this.moveTo(aX, mY);
      this.bezierCurveTo(aX, mY - vB, mX - hB, aY, mX, aY);
      this.bezierCurveTo(mX + hB, aY, eX, mY - vB, eX, mY);
      this.bezierCurveTo(eX, mY + vB, mX + hB, eY, mX, eY);
      this.bezierCurveTo(mX - hB, eY, aX, mY + vB, aX, mY);
      this.closePath();
    },
    fillEllipse:function(aX, aY, aWidth, aHeight){
      this.beginPath();
      this.ellipse(aX, aY, aWidth, aHeight);
      this.fill();
    },
    strokeEllipse:function(aX, aY, aWidth, aHeight){
      this.beginPath();
      this.ellipse(aX, aY, aWidth, aHeight);
      this.stroke();
    }
  };

  for(var key in extend)
    CanvasRenderingContext2D.prototype[key] = extend[key];
})();


function Annealing() {};
Annealing.prototype = {
  card: 0,
  width: 0,
  height: 0,
  k: 0,
  points: [],

  weight: null,
  currentPath: [],

  minWeight: null,
  minPath: [],

  timeout: null,

  t: null,
  t0: null,
  g: null,
  stepsPerT: null,
  step: 0,

  init: function(opts, width, height, listener) {
    this.points = opts.points;
    this.card = this.points.length;
    this.t0 = opts.t0;
    this.g = opts.g;
    this.stepsPerT  = opts.stepsPerT;
    this.stopValue = 0.000000001;

    this.listener = listener;

    this.width = width;
    this.height = height;


    for (var i = 0; i < this.card; i++)
      this.currentPath.push(i);

    this.t = this.t0;
  },
  go: function() {
    while (true) {
      this.cycle();
      if (this.t < this.stopValue)
        break;
    }
    if (this.listener)
      this.listener.onDone(this.minPath);
  },
  adoptPath: function(p, w) {
    this.currentPath = p;
    this.currentWeight = w;

    if (w < this.minWeight) {
      this.minWeight = w;
      this.minPath = p.slice(0);
      return true;
    }
    return false;
  },
  cycle: function() {
    this.step += 1;
    var newMin = false;
    var tmpPath = this.oneStep();
    var w = this.computeWeight(tmpPath);
    if (!this.currentWeight) {
      this.minWeight = w;
      this.minPath = tmpPath.slice(0);
      newMin = this.adoptPath(tmpPath, w);
    } else {
      var df = w - this.currentWeight;
      if (df > 0) {
        var p = Math.random();
        if (p <= Math.exp(-1 * df / this.t)) {
          newMin = this.adoptPath(tmpPath, w);
        }
      } else {
        newMin = this.adoptPath(tmpPath, w);
      }
    }
    if (this.step == this.stepsPerT) {
      this.step = 0;
      this.t *= this.g;
    }

    //if (newMin && this.listener)
    //  this.listener.onNewMin(this.minPath);
  },
  computeWeight: function(path) {
    var weight = 0;
    for (var i = 0; i < this.card; i++) {
      var idx = path[i];
      var prevIdx;
      if (i == 0) {
        prevIdx = path[this.card - 1];
      } else {
        prevIdx = path[i - 1];
      }

      var x0 = this.points[prevIdx].x;
      var y0 = this.points[prevIdx].y;

      var x1 = this.points[idx].x;
      var y1 = this.points[idx].y;
      
      weight += Math.sqrt(
        (x1 - x0) * (x1 - x0) +
        (y1 - y0) * (y1 - y0)
      );
    }
    return weight / (200 * this.card);
  },
  oneStep: function() {
    var i = Math.round(Math.random() * this.card);
    var j = Math.round(Math.random() * this.card);
    while (j == i)
      j = Math.round(Math.random() * this.card);

    var t = i;
    
    if (i > j) {
      i = j;
      j = t;
    }

    var v1 = this.currentPath.slice(0, i);
    var v2 = this.currentPath.slice(i, j);
    var v3 = this.currentPath.slice(j, this.card);
    return v1.concat(v2.reverse().concat(v3));
  }
}

function ThreadedAnnealing() {
  this.worker = new Worker("Worker.js");
};
ThreadedAnnealing.prototype = {
  init: function(opts, w, h, l) {
    this.worker.onmessage = function(event) {
console.log('onmessage here')
      var msg = event.data[0];
      var p = event.data[1];
      l[msg](p);
    };
    this.worker.onerror = function(event) {
console.log(event.message)
      dump("WORKER ERROR");
    };

    this.worker.postMessage(["init", {
          opts: opts,
          width: w,
          height: h
        }]);
  },
  go: function() {
    this.worker.postMessage(["go"]);
  }
}
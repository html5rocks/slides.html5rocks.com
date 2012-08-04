function Annealing() {};
Annealing.prototype = {
  complexity: 2, // control the ammount of time you want the algorithm to run
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
    var extra_points = [];
    for (var c = 0; c < this.complexity; c++) {
      var new_points = opts.points.slice(0);
      new_points = new_points.map(function(value){ return value+(c*10); });
      extra_points = extra_points.concat(new_points);
    }
    this.points = opts.points.concat(extra_points);
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
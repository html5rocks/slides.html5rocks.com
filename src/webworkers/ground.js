var ground = {
  clear: function(ctx) {
    // ctx.clearRect(0, 0, 200, 200);
  },
  drawPath: function(ctx, path) {
    // ctx.strokeStyle = "red";
    // ctx.fillStyle = "rgba(236, 138, 4, 0.5)";
    // ctx.strokeWidth = 5;
    // ctx.beginPath();
    var firstPoint = true;
    var l = ctx.allPoints.length;
    for (var i = 0; i < l - 1; i++) {
      var polyline = new GPolyline([new GLatLng(ctx.allPoints[i].x/5, ctx.allPoints[i].y/5), new GLatLng(ctx.allPoints[i+1].x/5, ctx.allPoints[i+1].y/5)], "#ff0000", 1);
      workermap.addOverlay(polyline);
      // var idx = path[i];
      // var x = ctx.allPoints[idx].x;
      // var y = ctx.allPoints[idx].y;
      // if (firstPoint) {
      //   ctx.moveTo(x, y);
      //   firstPoint = false;
      // } else {
      //   ctx.lineTo(x, y);
      // }
    }
    // ctx.closePath();
    // ctx.stroke();
    // ctx.fill();
  },
  drawPoints: function(ctx) {
    workermap.clearOverlays();
    var blueIcon = new GIcon(G_DEFAULT_ICON);
    blueIcon.image = "http://apirocks.com/html5/src/webworkers/point.png";
    blueIcon.iconSize = new GSize(3, 3);
    blueIcon.iconAnchor = new GPoint(0, 0);    
    blueIcon.shadow = null;
    // Set up our GMarkerOptions object
    markerOptions = { icon:blueIcon };
    
    // ctx.fillStyle = "red";
    for (var i = 0; i < ctx.allPoints.length; i++) {
      // ctx.fillRect(ctx.allPoints[i].x, ctx.allPoints[i].y, 6, 6);
      // Render in Gmap instead of canvas
      var point = new GLatLng(ctx.allPoints[i].x/5, ctx.allPoints[i].y/5);
      workermap.addOverlay(new GMarker(point, markerOptions));
    }
  },
  newGround: function(name, points) {
    // var h2 = document.createElement("h2");
    // h2.appendChild(document.createTextNode(name));

    // var canvas = document.createElement("canvas");
    // canvas.setAttribute("width", "200");
    // canvas.setAttribute("height", "150");

    // var div = document.createElement("div");
    // div.appendChild(h2);
    // div.appendChild(canvas);

    // var container = document.getElementById("groundContainer");

    // container.appendChild(div);
    // var ctx = canvas.getContext("2d");
    // ctx.scale(0.5,0.5);
    var ctx = {};
    ctx.allPoints = points;

    return ctx;
  }
};

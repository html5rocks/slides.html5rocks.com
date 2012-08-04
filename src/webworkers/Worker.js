// this whole script won't have access to the dom either
importScripts('annealing.js');

var annealing = new Annealing();

onmessage = function(event) {
  var callback = {
    onNewMin: function(p) {
      // postMessage('newmin')
      postMessage(JSON.stringify(["newMin", p]));
    },
    onDone: function(p) {
      // postMessage('draw')
      postMessage(JSON.stringify(["draw", p]));
    }
  };
  var passedData = JSON.parse(event.data);
  annealing.init(passedData.opts, passedData.width,
                passedData.height, callback)
  annealing.go();
}


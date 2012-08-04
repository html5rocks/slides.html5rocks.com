// The MIT License
// 
// Copyright (c) 2007 Ernest Delgado
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


var Canvas = window.Canvas || {};

(function () {

	/**
	 * Canvas Element Class
	 *
	 * @namespace Canvas.Element
	 * @class Element
	 * @constructor
	 */
	Canvas.Element = function() {};
	
	/**
	 * Constant for the default CSS class name that represents a Canvas
	 * @property Canvas.Element.CSS_CANVAS
	 * @static
	 * @final
	 * @type String
	 */
	/// Canvas.Element.CSS_CANVAS = "canvas-module";	
	Canvas.Element.prototype.fillBackground = true;
	Canvas.Element.prototype.showcorners = false;
	Canvas.Element.prototype.photoborder = true;
	Canvas.Element.prototype.polaroid = false;
	Canvas.Element.prototype._backgroundImg = null;
	
	/**
	 * The object literal containing mouse position if clicked in an empty area (no image)
	 * @property _groupSelector
	 * @type object
	 */
	Canvas.Element.prototype._groupSelector = null;
	
	/**
	 * The array element that contains all the images of the canvas
	 * @property _aImages
	 * @type object
	 */
	Canvas.Element.prototype._aImages = null;
	
	/**
	 * The element that references the canvas interface implementation
	 * @property _oContext
	 * @type object
	 */
	Canvas.Element.prototype._oContext = null;
	
	/**
	 * The main element that contains the canvas
	 * @property _oElement
	 * @type object
	 */
	Canvas.Element.prototype._oElement = null;

	/**
	 * The object literal containing config parameters
	 * @property _oConfig
	 * @type object
	 */
	Canvas.Element.prototype._oConfig = null;
	
	/**
	 * The object literal containing the current x,y params of the transformation
	 * @property _currentTransform
	 * @type object
	 */
	Canvas.Element.prototype._currentTransform = null;
	
	/**
	 * Init method
	 * @method init
	 * @param el {HTMLElement | String} Container element for the canvas.
	 * @param oConfig {Object} userConfig The configuration Object literal 
	 */
	Canvas.Element.prototype.init = function(el, oConfig) {
		if (el == '') {
			return;
		}
		this._initElement(el);
		this._initConfig(oConfig);
		this._createCanvasBackground();
		this._createContainer();
		this._initEvents();
		this._initCustomEvents();
	};
	
	/**
	 * The Canvas class's initialization method. This method is automatically 
	 * called by the constructor, and sets up all DOM references for 
	 * pre-existing markup, and creates required markup if it is not 
	 * already present.
	 * @method _initElement
	 * @param el {HTMLElement | String} el The element representing the Canvas
	 */
	Canvas.Element.prototype._initElement = function(el) {
		if(YAHOO.util.Dom.inDocument(el)) {
			if(YAHOO.lang.isString(el)) {
				this._oElement = document.getElementById(el);
			} else {
				this._oElement = el;
			}
			/// YAHOO.util.Dom.addClass(this._oElement, Canvas.Element.CSS_CANVAS);
		}
		else {
			if (YAHOO.env.ua.ie) {
				var canvasEl = excanvas(document.createElement('canvas'));	
			}
			else {
				var canvasEl = document.createElement('canvas');
			}
			canvasEl.id = el + '';
			var oCanvas = document.body.insertBefore(canvasEl, document.body.firstChild);
			this._oElement = document.getElementById(el + '');
		}
	
		// it contains the active image and the listeners
		this._oContextTop = this._oElement.getContext('2d');
	};

	/**
	 * The custom events initialization method. 
	 * @method _initCustomEvents
	 */
	Canvas.Element.prototype._initCustomEvents = function() {
		this.onRotateStart = new Canvas.CustomEvent('onRotateStart');
		this.onRotateMove = new Canvas.CustomEvent('onRotateMove');		
		this.onRotateComplete = new Canvas.CustomEvent('onRotateComplete');
		this.onDragStart = new Canvas.CustomEvent('onDragStart');	
		this.onDragMove = new Canvas.CustomEvent('onDragMove');
		this.onDragComplete = new Canvas.CustomEvent('onDragComplete');
	}
	
	/**
	 * For now we use an object literal without methods to store the config params
	 * @method _initConfig
	 * @param oConfig {Object} userConfig The configuration Object literal 
	 * containing the configuration that should be set for this module. 
	 * See configuration documentation for more details.
	 */
	Canvas.Element.prototype._initConfig = function(oConfig) {
		this._oConfig = oConfig;
		this._oElement.width = this._oConfig.width;
		this._oElement.height = this._oConfig.height;
		this._oElement.style.width = this._oConfig.width + 'px';
		this._oElement.style.height = this._oConfig.height + 'px';
	};

	/**
	 * Adds main mouse listeners to the whole canvas
	 * @method _initEvents
	 * See configuration documentation for more details.
	 */
	Canvas.Element.prototype._initEvents = function() {
		YAHOO.util.Event.on(this._oElement, 'mousedown', this.onMouseDown, this, true);
		YAHOO.util.Event.on(this._oElement, 'mouseup', this.onMouseUp, this, true);
		YAHOO.util.Event.on(this._oElement, 'mousemove', this.onMouseMove, this, true);
		// Canvas.Element.addEventListener("mousedown", function(evt) { startTransform(evt); }, false);
	};
	
	/**
	 * It creates a secondary canvas to contain all the images are not being translated/rotated/scaled
	 * @method _createContainer
	 */
	Canvas.Element.prototype._createContainer = function() {
		if (YAHOO.env.ua.ie) {
			var canvasEl = excanvas(document.createElement('canvas'));	
		}
		else {
			var canvasEl = document.createElement('canvas');
		}
		canvasEl.id = this._oElement.id + '-canvas-container';
		var oContainer = this._oElement.parentNode.insertBefore(canvasEl, this._oElement);
		oContainer.width = this._oConfig.width;
		oContainer.height = this._oConfig.height;
		oContainer.style.width = this._oConfig.width + 'px';
		oContainer.style.height = this._oConfig.height + 'px';
		// this will contain all images that are not on the top
		this._oContextContainer = oContainer.getContext('2d'); 
	};
	
	Canvas.Element.prototype._createCanvasBackground = function() {
		if (YAHOO.env.ua.ie) {
			var canvasEl = excanvas(document.createElement('canvas'));	
		}
		else {
			var canvasEl = document.createElement('canvas');
		}
		canvasEl.id = this._oElement.id + '-canvas-background';
		var oBackground = this._oElement.parentNode.insertBefore(canvasEl, this._oElement);
		oBackground.width = this._oConfig.width;
		oBackground.height = this._oConfig.height;
		oBackground.style.width = this._oConfig.width + 'px';
		oBackground.style.height = this._oConfig.height + 'px';
		// this will contain the background
		this._oContextBackground = oBackground.getContext('2d'); 
	};
	
	Canvas.Element.prototype.setCanvasBackground = function(oImg) {
		this._backgroundImg = oImg;
		var originalImgSize = oImg.getOriginalSize();
		
		this._oContextBackground.drawImage(oImg._oElement, 0, 0, originalImgSize.width, originalImgSize.height);
	};
	
	/**
	 * Method that defines the actions when mouse is released on canvas.
	 * The method resets the currentTransform parameters, store the image corner
	 * position in the image object and render the canvas on top.
	 * @method onMouseUp
	 * @param e {Event} Event object fired on mouseup
	 */
	Canvas.Element.prototype.onMouseUp = function(e) {
		if (this._aImages == null) {
			return;
		}
		if (this._currentTransform) {
			// determine the new coords everytime the image changes its position
			this._currentTransform.target.setImageCoords();
		}
		if (this._currentTransform != null && this._currentTransform.action == "rotate") {
			// fire custom rotate event handler
			this.onRotateComplete.fire(e);
		} else if (this._currentTransform != null && this._currentTransform.action == "drag") {
			// fire custom drag event handler
			this.onDragComplete.fire(e);
		}
		this._currentTransform = null;
		this._groupSelector = null;
		
		// this is to clear the selector box
		this.renderTop();
	};
	
	/**
	 * Method that defines the actions when mouse is clicked on canvas.
	 * The method inits the currentTransform parameters and renders all the
	 * canvas so the current image can be placed on the top canvas and the rest
	 * in on the container one.
	 * @method onMouseDown
	 * @param e {Event} Event object fired on mousedown
	 */
	Canvas.Element.prototype.onMouseDown = function(e) {
		var mp = this.findMousePosition(e);
		// ignore if something else is already going on
		if (this._currentTransform != null || this._aImages == null) {
			return;
		}
		
		// determine whether we clicked the image
		var oImg = this.findTargetImage(mp, false);
		if (!oImg) {
			this._groupSelector = { ex: mp.ex, ey: mp.ey,
				 					top: 0, left: 0 };
		}
		else { 
			// determine if it's a drag or rotate case
			// rotate and scale will happen at the same time
			var action = (!this.findTargetCorner(mp, oImg)) ? 'drag' : 'rotate';
			if (action == "rotate") {
				// fire custom rotate event handler
				this.onRotateMove.fire(e);
			} else if (action == "drag") {
				// fire custom drag event handler
				this.onDragMove.fire(e);
			}
			
			this._currentTransform = { 
				target: oImg,
				action: action,
				scalex: oImg.scalex,
				offsetX: mp.ex - oImg.left,
				offsetY: mp.ey - oImg.top,
				ex: mp.ex, ey: mp.ey,
				left: oImg.left, top: oImg.top,
				theta: oImg.theta 
			};
									
			// we must render all so the active image is placed in the canvastop
			this.renderAll(false);
		}
	};
	
	/**
	 * Method that defines the actions when mouse is hovering the canvas.
	 * The currentTransform parameter will definde whether the user is rotating/scaling/translating
	 * an image or neither of them (only hovering). A group selection is also possible and would cancel
	 * all any other type of action.
	 * In case of an image transformation only the top canvas will be rendered.
	 * @method onMouseMove
	 * @param e {Event} Event object fired on mousemove
	 */
	Canvas.Element.prototype.onMouseMove = function(e) {
		var mp = this.findMousePosition(e);
		if (this._aImages == null) {
			return;
		}
		if (this._groupSelector != null) {
			// We initially clicked in an empty area, so we draw a box for multiple selection.
			this._groupSelector.left = mp.ex - this._groupSelector.ex;
			this._groupSelector.top = mp.ey - this._groupSelector.ey;
			this.renderTop();
		}
		else if (this._currentTransform == null) {
			// Here we are hovering the canvas then we will determine
			// what part of the pictures we are hovering to change the caret symbol.
			// We won't do that while dragging or rotating in order to improve the
			// performance.
			var targetImg = this.findTargetImage(mp, true);

			// set mouse image
			this.setCursor(mp, targetImg);
		}
		else {
			if (this._currentTransform.action == 'rotate') {
				this.rotateImage(mp);
				this.scaleImage(mp);
				this.onRotateMove.fire(e);
			}		
			else {
				this.translateImage(mp);
				this.onDragMove.fire(e);
			}
			// only commit here. when we are actually moving the pictures
			this.renderTop();
		}		
	};

	/**
	 * Translate image
	 * @method translateImage
	 * @param e {Event} the mouse event
	 */	
	Canvas.Element.prototype.translateImage = function(mp) {
		this._currentTransform.target.left = mp.ex - this._currentTransform.offsetX;
		this._currentTransform.target.top = mp.ey - this._currentTransform.offsetY;
	};
	
	/**
	 * Scale image
	 * @method scaleImage
	 * @param e {Event} the mouse event
	 */	
	Canvas.Element.prototype.scaleImage = function(mp) {
		var lastLen = 
			Math.sqrt(Math.pow(this._currentTransform.ey - this._currentTransform.top, 2) +
			Math.pow(this._currentTransform.ex - this._currentTransform.left, 2));
		var curLen = 
			Math.sqrt(Math.pow(mp.ey - this._currentTransform.top, 2) +
			Math.pow(mp.ex - this._currentTransform.left, 2));

		this._currentTransform.target.scalex = this._currentTransform.scalex * (curLen / lastLen);
		this._currentTransform.target.scaley = this._currentTransform.target.scalex;
	};

	/**
	 * Rotate image
	 * @method rotateImage
	 * @param e {Event} the mouse event
	 */	
	Canvas.Element.prototype.rotateImage = function(mp) {
		var lastAngle = Math.atan2(
				this._currentTransform.ey - this._currentTransform.top,
				this._currentTransform.ex - this._currentTransform.left
		);
		
		var curAngle = Math.atan2(
			mp.ey - this._currentTransform.top,
			mp.ex - this._currentTransform.left
		);
				
		this._currentTransform.target.theta = (curAngle - lastAngle) + this._currentTransform.theta;
	};
	
	/**
	 * Method to set the cursor image depending on where the user is hovering.
 	 * Note: very buggy in Opera
	 * @method setCursor
	 * @param e {Event} the mouse event
	 * @param targetImg {Object} image that the mouse is hovering, if so.
	 */
	Canvas.Element.prototype.setCursor = function(mp, targetImg) {
		if (!targetImg) {
			this._oElement.style.cursor = 'default';
		}
		else { 
			var corner = this.findTargetCorner(mp, targetImg);
			if (!corner) {
				this._oElement.style.cursor = 'move';
			}
			else {
				if(corner == 'tr') {
					this._oElement.style.cursor = 'ne-resize';
				}
				else if(corner == 'br') {
					this._oElement.style.cursor = 'se-resize';
				}
				else if(corner == 'bl') {
					this._oElement.style.cursor = 'sw-resize';
				}
				else if(corner == 'tl') {
					this._oElement.style.cursor = 'nw-resize';
				}									
				else {
					this._oElement.style.cursor = 'default';
				}
			}
		}
	};
	
	/**
	 * Method to add an image to the canvas.
 	 * It actually only pushes the images in an array that will be rendered later in the canvas.
	 * @method addImage
	 * @param oImg {Object} Image elment to attach
	 */
	Canvas.Element.prototype.addImage = function(oImg) {
		// this._aImages[this._aImages.length] = oImg;
		if(YAHOO.lang.isNull(this._aImages)) {
			this._aImages = [];
		}
		this._aImages.push(oImg);
		this.renderAll(false);

	};

	/**
	 * Method to render both the top canvas and the secondary container canvas.
	 * @method renderAll
	 * @param allOnTop {Boolean} Whether we want to force all images to be rendered on the top canvas
	 */	
	Canvas.Element.prototype.renderAll = function(allOnTop) {
		// when allOnTop equals true all images will be rendered in the top canvas.
		// This is used for actions like toDataUrl that needs to take some actions on a unique canvas.
		var containerCanvas = (allOnTop) ? this._oContextTop : this._oContextContainer;
		
		this._oContextTop.clearRect(0,0,parseInt(this._oConfig.width), parseInt(this._oConfig.height));
		containerCanvas.clearRect(0,0,parseInt(this._oConfig.width), parseInt(this._oConfig.height));
		
		if (allOnTop) {
			var originalImgSize = this._backgroundImg.getOriginalSize();
			this._oContextTop.drawImage(this._backgroundImg._oElement, 0, 0, originalImgSize.width, originalImgSize.height);
		}
		
		// we render the rest of images
		for (var i = 0, l = this._aImages.length-1; i < l; i += 1) {
			this.drawImageElement(containerCanvas, this._aImages[i]);			
		}
		// we render the top context
		this.drawImageElement(this._oContextTop, this._aImages[this._aImages.length-1]);
	};
	
	/**
	 * Method to render only the top canvas.
	 * Also used to render the group selection box.
	 * @method renderTop
	 */
	Canvas.Element.prototype.renderTop = function() {
		// this.beforeRenderEvent.fire();  // placeholder
		this._oContextTop.clearRect(0,0,parseInt(this._oConfig.width), parseInt(this._oConfig.height));
		
		// we render the top context
		this.drawImageElement(this._oContextTop, this._aImages[this._aImages.length-1]);
		
		if (this._groupSelector != null) {
			this._oContextTop.fillStyle = "rgba(0, 0, 200, 0.5)";
			this._oContextTop.fillRect(
				this._groupSelector.ex - ((this._groupSelector.left > 0) ?
					0 : - this._groupSelector.left), 
				this._groupSelector.ey - ((this._groupSelector.top > 0) ? 
					0 : - this._groupSelector.top), 
				Math.abs(this._groupSelector.left), 
				Math.abs(this._groupSelector.top)
			);
			this._oContextTop.strokeRect(
				this._groupSelector.ex - ((this._groupSelector.left > 0) ? 
					0 : Math.abs(this._groupSelector.left)), 
				this._groupSelector.ey - ((this._groupSelector.top > 0) ? 
					0 : Math.abs(this._groupSelector.top)), 
				Math.abs(this._groupSelector.left), 
				Math.abs(this._groupSelector.top)
			);
		}
	};
	
	/**
	 * Method that finally uses the canvas function to render the image
	 * @method drawImageElement
	 * @param context {Object} canvas context where the image must be rendered
	 * @param oImg {Object} the image object
	 */
	Canvas.Element.prototype.drawImageElement = function(context, oImg) {
		var offsetY = oImg.height / 2;
		var offsetX = oImg.width / 2;

		context.save();
		context.translate(oImg.left, oImg.top);
		context.rotate(oImg.theta);
		context.scale(oImg.scalex, oImg.scaley);
		
		this.drawBorder(context, oImg, offsetX, offsetY);
		
		var originalImgSize = oImg.getOriginalSize();
		
		// drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
		// A = oImg.width - oImg._oElement.width = oImg.borderwidth (if any)
		// B = oImg.height - oImg._oElement.height = oImg.borderwidth + oImg.polaroidheight
		// B - A = oImg.polaroidheight
		var polaroidHeight = ((oImg.height - originalImgSize.height) - (oImg.width - originalImgSize.width))/2;
		
		context.drawImage(
			oImg._oElement, 
			- originalImgSize.width/2,  
			(- originalImgSize.height)/2 - polaroidHeight, 
			originalImgSize.width, 
			originalImgSize.height
		);
					
		if (oImg.cornervisibility) {
			this.drawCorners(context, oImg, offsetX, offsetY);
		}
		context.restore();
	};
		
	/**
	 * Method that returns an object with the image lines in it given the coordinates of the corners
	 * @method _getImageLines
	 * @param oCoords {Object} coordinates of the image corners
	 */
	Canvas.Element.prototype._getImageLines = function(oCoords) {
		return {
			topline: { 
				o: oCoords.tl,
				d: oCoords.tr 
			},
			rightline: { 
				o: oCoords.tr,
				d: oCoords.br 
			},
			bottomline: { 
				o: oCoords.br,
				d: oCoords.bl 
			},
			leftline: { 
				o: oCoords.bl,
				d: oCoords.tl 
			}
		}
	};

	/**
	 * Method that determines what picture are we clicking on
	 * Applied one implementation of 'point inside polygon' algorithm
	 * @method findTargetImage
	 * @param e {Event} the mouse event
	 * @param hovering {Boolean} whether or not we have the mouse button pressed
	 */	
	Canvas.Element.prototype.findTargetImage = function(mp, hovering) {
		// http://www.geog.ubc.ca/courses/klink/gis.notes/ncgia/u32.html
		// http://idav.ucdavis.edu/~okreylos/TAship/Spring2000/PointInPolygon.html
		for (var i = this._aImages.length-1; i >= 0; i -= 1) {
			// we iterate through each image. If target found then return target
			var iLines = this._getImageLines(this._aImages[i].oCoords);
			var xpoints = this._findCrossPoints(mp, iLines);
			
			// if xcount is odd then we clicked inside the image
			// For the specific case of square images xcount == 1 in all true cases
			if (xpoints % 2 == 1 && xpoints != 0) {
				var target = this._aImages[i];
				//reorder array
				if (!hovering) {
					this._aImages.splice(i, 1);
					this._aImages.push(target);
				}
				return target;
			}
		}
		return false;
	};

	/**
	 * Helper method to determine how many cross points are between the 4 image edges
	 * and the horizontal line determined by the position of our mouse when clicked on canvas
	 * @method _findCrossPoints
	 * @param ex {Number} x coordinate of the mouse
	 * @param ey {Number} y coordinate of the mouse
	 * @param oCoords {Object} Coordinates of the image being evaluated
	 */		
	Canvas.Element.prototype._findCrossPoints = function(mp, oCoords) {
		var b1, b2, a1, a2, xi, yi;
		var xcount = 0;
		var iLine = null;
		for (lineKey in oCoords) {
			iLine = oCoords[lineKey];
			// optimisation 1: line below dot. no cross
			if ((iLine.o.y < mp.ey) && (iLine.d.y < mp.ey)) {
				continue;
			}
			// optimisation 2: line above dot. no cross
			if ((iLine.o.y >= mp.ey) && (iLine.d.y >= mp.ey)) {
				continue;
			}
			// optimisation 3: vertical line case
			if ((iLine.o.x == iLine.d.x) && (iLine.o.x >= mp.ex)) { 
				xi = iLine.o.x;
				yi = mp.ey;
			}
			// calculate the intersection point
			else {
				b1 = 0; //(y2-mp.ey)/(x2-mp.ex); 
				b2 = (iLine.d.y-iLine.o.y)/(iLine.d.x-iLine.o.x); 
				a1 = mp.ey-b1*mp.ex;
				a2 = iLine.o.y-b2*iLine.o.x;

				xi = - (a1-a2)/(b1-b2); 
				yi = a1+b1*xi; 
			}
		
			// dont count xi < mp.ex cases
			if (xi >= mp.ex) { 
				xcount += 1;
			}
			// optimisation 4: specific for square images
			if (xcount == 2) {
				break;
			}
		}
		return xcount;
	};
	
	/**
	 * Determine which one of the four corners has been clicked
	 * @method findTargetCorner
	 * @param e {Event} the mouse event
	 * @param oImg {Object} the image object
	 */
	Canvas.Element.prototype.findTargetCorner = function(mp, oImg) {
		var xpoints = null;
		
		var corners = ['tl','tr','br','bl'];
		for (var i in oImg.oCoords) {
			xpoints = this._findCrossPoints(mp, this._getImageLines(oImg.oCoords[i].corner));
			if (xpoints % 2 == 1 && xpoints != 0) {
				return i;
			}		
		}
		return false;
	};

	/**
	 * Determine which one of the four corners has been clicked
	 * @method findTargetCorner
	 * @param e {Event} the mouse event
	 * @param oImg {Object} the image object
	 */
	Canvas.Element.prototype.findMousePosition = function(e) {
		// srcElement = IE
		var parentNode = (e.srcElement) ? e.srcElement.parentNode : e.target.parentNode;
		var isSafari2 = (YAHOO.env.ua.webkit != 0 && YAHOO.env.ua.webkit < 420);
		var scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
		var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
		var safariOffsetLeft = (isSafari2) ? e.target.ownerDocument.body.offsetLeft + scrollLeft : 0;
		var safariOffsetTop = (isSafari2) ? e.target.ownerDocument.body.offsetTop + scrollTop : 0;
		return {
			ex: e.clientX + scrollLeft - parentNode.offsetLeft - safariOffsetLeft,
			ey: e.clientY + scrollTop - parentNode.offsetTop - safariOffsetTop,
			screenX: e.screenX,
			screenY: e.screenY
		};
	};

	/**
	 * Draw image border, if any. That includes both normal border and polaroid border
	 * @method drawBorder
	 * @param context {Object} context (layer) where the border will be drawn
	 * @param oImg {Object} the Image object
	 * @param offsetX {Number} The horizontal offset applied from the (0,0) of the canvas axis
	 * @param offsetY {Number} The vertical offset applied from the (0,0) of the canvas axis
	 */	
	Canvas.Element.prototype.drawBorder = function(context, oImg, offsetX, offsetY) {
		var outlinewidth = 2;
		context.fillStyle = 'rgba(0, 0, 0, .3)';
		context.fillRect(-2 - offsetX, -2 - offsetY, oImg.width + (2 * outlinewidth), oImg.height + (2 * outlinewidth));
		context.fillStyle = '#fff';
		context.fillRect(-offsetX, -offsetY, oImg.width, oImg.height);
	};

	/**
	 * Draw image corners to help visual understanding of the UI (if required)
	 * @method drawCorners
	 * @param context {Object} context (layer) where the corners will be drawn
	 * @param oImg {Object} the Image object
	 * @param offsetX {Number} The horizontal offset applied from the (0,0) of the canvas axis
	 * @param offsetY {Number} The vertical offset applied from the (0,0) of the canvas axis
	 */	
	Canvas.Element.prototype.drawCorners = function(context, oImg, offsetX, offsetY) {
		context.fillStyle = "rgba(0, 200, 50, 0.5)";
		context.fillRect(-offsetX, -offsetY, oImg.cornersize, oImg.cornersize);
		context.fillRect(oImg.width - offsetX - oImg.cornersize, -offsetY, oImg.cornersize, oImg.cornersize);
		context.fillRect(-offsetX, oImg.height - offsetY - oImg.cornersize, oImg.cornersize, oImg.cornersize);
		context.fillRect(oImg.width - offsetX - oImg.cornersize, oImg.height - offsetY - oImg.cornersize, oImg.cornersize, oImg.cornersize);
	};

	/**
	 * Export the specific canvas element to an Image. Created and rendered on the browser.
	 * Beware of crossbrowser support.
	 * @method canvasTo
	 * @param format {String} the format of the output image. Either jpeg or png.
	 */	
	Canvas.Element.prototype.canvasTo = function(format) {
		this.renderAll(true);
		if (format == 'jpeg' || format == 'png') {
			return this._oElement.toDataURL('image/'+format);
		}
	};
	
	/**
	 * Hook onto "interesting moments" in the lifecycle of Canvas Element
	 * @method subscribe
	 * @param type {String} The type of event.
	 * @param fn {Function} The handler function
	 * @param scope {Object} An object to become the execution scope of the handler.
	 */
	Canvas.Element.prototype.subscribe = function(type, fn, scope) {
		if(typeof this[type] == "undefined") {
			throw new Error("Invalid custom event name: " + type);
		}
		if(typeof fn != "function") {
			throw new Error("Invalid handler function.");
		}
		this[type].scope = scope || window;
		this[type].handler = fn;
	};
	
	Canvas.CustomEvent = function(type) {
		this.type = type;
		this.scope = null;
		this.handler = null;
		var self = this;
		this.fire = function(e) {
			if(this.handler != null) {
				self.handler.call(self.scope, e);
			}
		};
	};
	
	
}());
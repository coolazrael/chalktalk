
// GENERAL UTILITY FUNCTIONS:

   function arrayToString(a, level) {
      if (level === undefined)
         level = 0;
      var spacer = level == 0 ? " " : "";
      var str = "[" + spacer;
      for (var i = 0 ; i < a.length ; i++)
         str += (a[i] instanceof Array ? arrayToString(a[i], level+1) : a[i])
              + spacer + (i < a.length-1 ? "," + spacer : "]");
      return str;
   }
   function hexChar(n) {
      return String.fromCharCode((n < 10 ? 48 : 87) + n);
   }
   function hex(n) {
      return hexChar(n >> 4) + hexChar(n & 15);
   }
   function isDef(v) { return ! (v === undefined); }
   function isNumber(v) { return ! isNaN(v); }
   function roundedString(v) {
      if (typeof(v) == 'string')
         v = parseFloat(v);
      return "" + ((v < 0 ? -1 : 1) * floor(100 * abs(v) + 0.5) / 100);
   }

// HANDLE PLAYING AN AUDIO SIGNAL:

   var audioNode = null, audioIndex = 0;

   var setAudioSignal= function(f) {
      if (audioNode == null) {
         audioContext = 'AudioContext' in window ? new AudioContext() :
                        'webkitAudioContext' in window ? new webkitAudioContext() : null;
         if (audioContext != null) {
            audioNode = audioContext.createScriptProcessor(1024, 0, 1);
            audioNode.connect(audioContext.destination);
         }
      }
      if (audioNode != null) {
         audioNode.onaudioprocess = function(event) {
            var output = event.outputBuffer;
            var signal = output.getChannelData(0);
	    if (f instanceof Array)
               for (var i = 0 ; i < output.length ; i++)
                  signal[i] = f[audioIndex++ % f.length];
	    else
               for (var i = 0 ; i < output.length ; i++)
                  signal[i] = f(audioIndex++ / output.sampleRate);
         }
      }
   }

// INITIALIZE HANDLING OF KEYBOARD AND MOUSE EVENTS ON A CANVAS:

   function startPullDown(x, y) {
      if (pullDownLabels.length > 0) {
         isPullDown = true;
         pullDownSelection = -1;
         sketchLabelSelection = -1;
         pullDownX = x;
         pullDownY = y;
      }
   }

   function startPieMenu(x, y) {
      pieMenuStrokes = null;
      isPieMenu = true;
      pieMenuX = pieMenuMouseX = pieMenuXDown = x;
      pieMenuY = pieMenuMouseY = pieMenuYDown = y;
   }

   function endPieMenu() {

      pieMenuStrokes = segmentStroke(pieMenuStroke);
      pieMenuStroke = [];

      pieMenuCode = [];
      for (var n = 1 ; n < pieMenuStrokes.length ; n++) {
         var s = pieMenuStrokes[n];
         var angle = atan2(pieMenuYDown - s[0][1], s[0][0] - pieMenuXDown);
         pieMenuCode.push(floor(PMA + 0.5 + PMA * angle / TAU) % PMA);
      }
      if (pieMenuCode.length > 0) {
         var index = 0;
         if (pieMenuCode.length > 1)
            index = (pieMenuCode[1] - pieMenuCode[0] + PMA) % PMA;
         if (pieMenuCode[0] == 0) {
            selectSketchPageAction(index);
         }
         else {
            addSketchOfType(pieMenuCode[0] - 1);
            sk().setSelection(index);
            isSketchDrawingEnabled = true;
         }
      }
      pieMenuCursorWeight = 1;
   }

   function selectSketchPageAction(index) {
      switch (pageActionLabels[index]) {
      case "text"      : toggleTextMode(); break;
      case "clone"     : copySketch(sk()); break;
      case "group"     : sketchPage.isCreatingGroup = true; break;
      case "whiteboard": sketchPage.isWhiteboard =
                         ! sketchPage.isWhiteboard; break;
      case "clear"     : clearSketchPage(); break;
      }
   }

   var mouseMoveEvent = null;

   function initEventHandlers(canvas) {
      function getHandle(canvas) { return window[canvas.id]; }

      var handle = getHandle(canvas);
      handle.mouseX = 1000;
      handle.mouseY = 1000;
      handle.mousePressed = false;

      canvas.onkeydown = function(event) {
         var handle = getHandle(this);
         if (isDef(handle.keyDown)) {
            event = event || window.event;

            // PREVENT BROWSER FROM SCROLLING IN RESPONSE TO CERTAIN KEYS.

            switch (event.keyCode) {
            case 32: // ASCII SPACE
            case 33: // ASCII PAGE UP
            case 34: // ASCII PAGE DOWN
            case 37: // ASCII LEFT ARROW
            case 38: // ASCII UP ARROW
            case 39: // ASCII RIGHT ARROW
            case 40: // ASCII DOWN ARROW
               event.preventDefault();
               break;
            }

            handle.keyDown(event.keyCode);
         }
      }

      canvas.onkeyup = function(event) {
         var handle = getHandle(this);
         if (isDef(handle.keyUp)) {
            event = event || window.event;
            handle.keyUp(event.keyCode);
         }
      }

      canvas.onkeypress = function(event) {
         switch (event.keyCode) {
         case 8:
             event.preventDefault();
             break;
         }
         var handle = getHandle(this);
         if (isDef(handle.keyPress)) {
            event = event || window.event;
            handle.keyPress(event.keyCode);
         }
      }

      // MOUSE PRESSED.

      canvas.onmousedown = function(event) {

         if (event.which == 3) {
            isRightButtonPressed = true;
         }

         // RESPOND DIFFERENTLY TO LEFT AND RIGHT MOUSE BUTTONS

         if ((event.which && event.which !== 1) ||
             (event.button && event.button !== 1))
            return;

         if (sketchAction != null)
            return;

         if (isPullDown)
            return;

         var handle = getHandle(this);
         var r = event.target.getBoundingClientRect();
         handle.mouseX = event.clientX - r.left;
         handle.mouseY = event.clientY - r.top;
         handle.mousePressedAtX = handle.mouseX;
         handle.mousePressedAtY = handle.mouseY;
         handle.mousePressedAtTime = time;
         handle.mousePressed = true;

         if ( handle.mouseX >= 0 && handle.mouseX <= r.right - r.left &&
              handle.mouseY >= 0 && handle.mouseY <= r.bottom - r.top &&
              isDef(handle.mouseDown) )
            handle.mouseDown(handle.mouseX, handle.mouseY);
      };

      // MAKE SURE BROWSER CATCHES RIGHT CLICK.

      canvas.oncontextmenu = function(event) {
         setTextMode(false);
         try {
            if (isMouseOverBackground)
               pullDownLabels = pagePullDownLabels;
            startPullDown(handle.mouseX, handle.mouseY);
         } catch (e) {}
         return false;
      };

      // MOUSE RELEASED.

      canvas.onmouseup = function(event) {

         if (event.which == 3) {
            isRightButtonPressed = false;
         }

         // RESPOND ONLY TO LEFT MOUSE UP, NOT TO RIGHT MOUSE UP.

         if ((event.which && event.which !== 1) ||
             (event.button && event.button !== 1))
            return;

         if (sketchAction != null) {
            if (sketchAction == "linking")
               sketchPage.figureOutLink();
            sketchAction = null;
            return;
         }

         var handle = getHandle(this);
         var r = event.target.getBoundingClientRect();
         handle.mouseX = event.clientX - r.left;
         handle.mouseY = event.clientY - r.top;
         handle.mousePressed = false;

         // HANDLE PULLDOWN MENU SELECTION ACTION.

         if (isPullDown) {
            if (pullDownSelection >= 0)

               // AFTER PULLDOWN OVER THE PAGE BACKGROUND

               if (pullDownLabels == pagePullDownLabels) {

                  // BASIC MENU ACTIONS FOR ANY PAGE

                  if (pullDownSelection < pageActionLabels.length) {
                     selectSketchPageAction(pullDownSelection);
                  }

                  // CREATE A NEW SKETCH OF SOME TYPE

                  else {
                     This().mouseX = pullDownX;
                     This().mouseY = pullDownY;
                     addSketchOfType(pullDownSelection - pageActionLabels.length);
                     sk().setSelection(max(0, sketchLabelSelection));
                  }
               }

               // AFTER PULLDOWN OVER A SKETCH

               else {

                  // BASIC MENU ACTIONS FOR ANY SKETCH TYPE

                  if (pullDownSelection < sketchActionLabels.length) {
                     sketchAction = sketchActionLabels[pullDownSelection];
                     sketchPage.mx = This().mouseX;
                     sketchPage.my = This().mouseY;
                     switch(sketchAction) {
                     case "text":
                        toggleTextMode(sk());
                        break;
                     case "parsing":
                        sk().parse();
                        sketchAction = null;
                        break;
                     case "deleting":
                        deleteSketch(sk());
                        sketchAction = null;
                        break;
                     }
                  }

                  // GROUP-SPECIFIC ACTIONS

                  else if (sk().isGroup()) {
                     switch (pullDownLabels[pullDownSelection]) {
                     case 'ungroup':
                        sketchPage.toggleGroup();
                        break;
                     }
                  }

                  // PREPARE FOR MOUSE MOVE RESPONSE SPECIFIC TO THIS SKETCH TYPE

                  else {
                     sk().setSelection(pullDownSelection - sketchActionLabels.length);
                  }
               }
            isPullDownPressed = false;
            isPullDown = false;
            return;
         }

         if (isDef(handle.mouseUp))
            handle.mouseUp(handle.mouseX, handle.mouseY);
      }

      // MOUSE IS MOVED.

      canvas.onmousemove = function(event) {
         mouseMoveEvent = event;

         if (isRightButtonPressed) {
            ;
         }

         var handle = getHandle(this);
         var r = event.target.getBoundingClientRect();
         handle.mouseX = event.clientX - r.left;
         handle.mouseY = event.clientY - r.top;

         if (isPullDown)
            return;

         // MOUSE IS BEING DRAGGED.

         if (handle.mousePressed) {
            if (sketchAction != null)
               return;

            if (isDef(handle.mouseDrag)) {
                if (len(handle.mouseX - handle.mousePressedAtX,
                        handle.mouseY - handle.mousePressedAtY) >= 1)
                   handle.mouseIsDragging = true;

                if (handle.mouseIsDragging)
                   handle.mouseDrag(handle.mouseX, handle.mouseY);
            }
         }

         // MOUSE IS BEING MOVED WITHOUT BUTTONS PRESSED.

         else if (handle.mouseX >= 0 && handle.mouseX <= r.right - r.left &&
                  handle.mouseY >= 0 && handle.mouseY <= r.bottom - r.top &&
                  isDef(handle.mouseMove))
            handle.mouseMove(handle.mouseX, handle.mouseY);

         // WHILE SKETCHING: ADVANCE SKETCH AT SAME RATE AS MOUSE MOVEMENT.

         if (isk() && sk().sketchState == 'in progress' && isSketchDrawingEnabled
                                                        && sk().sketchProgress < 1) {
            var dx = handle.mouseX - _g.mouseX;
            var dy = handle.mouseY - _g.mouseY;
            var t = sqrt(dx*dx + dy*dy) / sk().sketchLength;
            sk().sketchProgress = min(1, sk().sketchProgress + t);
            _g.mouseX = handle.mouseX;
            _g.mouseY = handle.mouseY;
         }
      }
   }

// HANDLE SET OPERATIONS:

   function Set() {
      this.debug = false;
      this.add = function(item) {
         if (! this.contains(item))
            this.push(item);
      }

      this.remove = function(item) {
         var index = this.indexOf(item);
         if (index >= 0)
            this.splice(index, 1);
      }

      this.contains = function(item) {
         return this.indexOf(item) >= 0;
      }

      this.indexOf = function(item) {
         for (var i = 0 ; i < this.length ; i++)
            if (equals(item, this[i]))
               return i;
         return -1;
      }

      function equals(a, b) {
         if (a instanceof Array) {
            for (var i = 0 ; i < a.length ; i++)
               if (! equals(a[i], b[i]))
                  return false;
            return true;
         }
         return a == b;
      }

      this.toString = function() {
         var str = "[";
         for (var i = 0 ; i < this.length ; i++)
            str += this[i] + (i<this.length-1 ? "," : "]");
         return str;
      }
   }
   Set.prototype = new Array;

// WRAPPER FOR MATRIX FUNCTIONS

   function save() { _g.save(); }
   function restore() { _g.restore(); }
   function identity() { _g.setTransform(1,0,0,0,1,0); }
   function translate(x, y) { _g.translate(x, y); }
   function rotate(a) { _g.rotate(a); }
   function scale(x, y) { if (! isDef(y)) y = x; _g.scale(x,y); }

// PHYSICS

   // Physics objects must inherit from "Clonable" for cloning to work properly.

   function Clonable() { }

   function Spring() {
      this.P = 0;
      this.V = 0;
      this.F = 0;
      this.mass = 1.0;
      this.damping = 1.0;

      this.getPosition = function()  { return this.P; }
      this.setDamping  = function(t) { this.damping = t; }
      this.setForce    = function(t) { this.F = t; }
      this.setMass     = function(t) { this.mass = Math.max(0.001, t); }

      this.update      = function(elapsed) {
         this.V += (this.F - this.P) / this.mass * elapsed;
         this.P  = (this.P + this.V) * (1 - this.damping * elapsed);
      }
   }
   Spring.prototype = new Clonable;

// MATH CONSTANTS AND UTILITY FUNCTIONS

   var PI = Math.PI;
   var TAU = 2 * PI;

   function abs(a) { return Math.abs(a); }
   function asin(a) { return Math.asin(a); }
   function atan(a) { return Math.atan(a); }
   function atan2(a, b) { return Math.atan2(a, b); }
   function cos(t) { return Math.cos(t); }
   function cotan(t) { return Math.cotan(t); }
   function distance(a, b) { return len(a[0] - b[0], a[1] - b[1]); }
   function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
   function isEqualArray(a, b) {
      if (a === undefined || b === undefined ||
          a == null || b == null || a.length != b.length)
         return false;
      for (var i = 0 ; i < a.length ; i++)
         if (a[i] != b[i])
            return false;
      return true;
   }
   function floor(t) { return Math.floor(t); }
   function ik(a, b, C, D) {
      var cc = dot(C,C), x = (1 + (a*a - b*b)/cc) / 2, y = dot(C,D)/cc;
      for (var i = 0 ; i < 3 ; i++) D[i] -= y * C[i];
      y = sqrt(max(0,a*a - cc*x*x) / dot(D,D));
      for (var i = 0 ; i < 3 ; i++) D[i] = x * C[i] + y * D[i];
   }
   function len(x, y) {
      if (y === undefined)
         return sqrt(x[0] * x[0] + x[1] * x[1]);
      return sqrt(x * x + y * y);
   }
   function lerp(t, a, b) { return a + t * (b - a); }
   function min(a, b) { return Math.min(a, b); }
   function max(a, b) { return Math.max(a, b); }
   var noise2P = [], noise2U = [], noise2V = [];
   function noise2(x, y) {
      if (noise2P.length == 0) {
         var p = noise2P, u = noise2U, v = noise2V, i, j;
         for (i = 0 ; i < 256 ; i++) {
            p[i] = i;
            u[i] = 2 * random() - 1;
            v[i] = 2 * random() - 1;
            var s = sqrt(u[i]*u[i] + v[i]*v[i]);
            u[i] /= s;
            v[i] /= s;
         }
         while (--i) {
            var k = p[i];
            p[i] = p[j = floor(256 * random())];
            p[j] = k;
         }
         for (i = 0 ; i < 256 + 2 ; i++) {
            p[256 + i] = p[i];
            u[256 + i] = u[i];
            v[256 + i] = v[i];
         }
      }
      var P = noise2P, U = noise2U, V = noise2V;
      x = (x + 4096) % 256;
      y = (y + 4096) % 256;
      var i = floor(x), u = x - i, s = sCurve(u);
      var j = floor(y), v = y - j, t = sCurve(v);
      var a = P[P[i] + j  ], b = P[P[i+1] + j  ];
      var c = P[P[i] + j+1], d = P[P[i+1] + j+1];
      return lerp(t, lerp(s, u*U[a] +  v   *V[a], (u-1)*U[b] +  v   *V[b]),
                     lerp(s, u*U[c] + (v-1)*V[c], (u-1)*U[d] + (v-1)*V[d]));
   }
   var _rSeed = 1;
   function pow(a, b) { return Math.pow(a, b); }
   function random() { var x = 10000*sin(_rSeed++); return x-floor(x); }
   function sCurve(t) { return t * t * (3 - t - t); }
   function saw(t) { t = 2*t % 2; return t<1 ? t : 2-t; }
   function square_wave(t) { return 2 * floor(2*t % 2) - 1; }
   function sin(t) { return Math.sin(t); }
   function sqrt(t) { return Math.sqrt(t); }
   function tan(t) { return Math.tan(t); }
   function value(t) { return isDef(t) ? t : "0"; }

// CHARACTER CONSTANTS AND CONVERSIONS.

   var ALT     = '\u22C0' ;
   var C_PHI   = '\u03A6' ;
   var C_THETA = '\u0398' ;
   var COMMAND = '\u2318' ;
   var CONTROL = '\u2201' ;
   var D_ARROW = '\u2193' ;
   var L_ARROW = '\u2190' ;
   var PAGE_UP = 'PAGE_UP';
   var PAGE_DN = 'PAGE_DN';
   var R_ARROW = '\u2192' ;
   var S_PHI   = '\u03C6' ;
   var S_THETA = '\u03B8' ;
   var U_ARROW = '\u2191' ;

   function charCodeToString(key) {
      if (isShiftPressed)
         switch (key) {
         case 48: return ')'; // SHIFT 1
         case 49: return '!';
         case 50: return '@';
         case 51: return '#';
         case 52: return '$';
         case 53: return '%';
         case 54: return '^';
         case 55: return '&';
         case 56: return '*';
         case 57: return '('; // SHIFT 0

         case 186: return ':';
         case 187: return '+';
         case 188: return '<';
         case 189: return '_';
         case 190: return '>';
         case 191: return '?';
         case 192: return '~';
         case 219: return '{';
         case 220: return '|';
         case 221: return '}';
         case 222: return '"';
         }

      switch (key) {
      case   8: return 'del';
      case  13: return 'ret';
      case  16: return 'cap';
      case  17: return 'control';
      case  18: return 'alt';
      case  27: return 'esc';
      case  32: return 'spc';
      case  32: return 'spc';
      case  33: return PAGE_UP;
      case  34: return PAGE_DN;
      case  37: return L_ARROW;
      case  38: return U_ARROW;
      case  39: return R_ARROW;
      case  40: return D_ARROW;
      case  91: return 'command';
      case 186: return ';';
      case 187: return '=';
      case 188: return ',';
      case 189: return '-';
      case 190: return '.';
      case 191: return '/';
      case 192: return '`';
      case 219: return '[';
      case 220: return '\\';
      case 221: return ']';
      case 222: return "'";
      }

      var str = String.fromCharCode(key);

      if (key >= 64 && key < 64 + 32 && ! isShiftPressed)
         str = str.toLowerCase();

      return str;
   }

// ARRAY UTILITIES.

   function getIndex(arr, obj) {
      var i = arr.length;
      while (--i >= 0 && arr[i] != obj) ;
         return i;
   }

   function findEmptySlot(arr) {
      var n = 0;
      while (n < arr.length && isDef(arr[n]) && arr[n] != null)
         n++;
      return n;
   }

// 2D GEOMETRY UTILITIES.

   function isInRect(x,y, R) {
      return x >= R[0] && y >= R[1] && x < R[2] && y < R[3];
   }

   function clipLineToRect(ax,ay, bx,by, R) {
      var tx = bx < R[0] ? (R[0] - ax) / (bx - ax) :
               bx > R[2] ? (R[2] - ax) / (bx - ax) : 10000;
      var ty = by < R[1] ? (R[1] - ay) / (by - ay) :
               by > R[3] ? (R[3] - ay) / (by - ay) : 10000;
      var t = max(0, min(1, min(tx, ty)));
      return [lerp(t, ax, bx), lerp(t, ay, by)];
   }

   // Create an arc of a circle.

   function createArc(x, y, r, a0, a1, n) {
      var c = [];
      for (var i = 0 ; i <= n ; i++) {
         var a = a0 + i * (a1 - a0) / n;
         c.push([x + r * cos(a), y + r * sin(a)]);
      }
      return c;
   }

   // Create a curved line.

   function createCurve(A, B, curvature, N) {
      if (N === undefined)
         N = 20;

      var ax = A[0], ay = A[1], bx = B[0], by = B[1];
      var dx = 4 * curvature * (bx - ax);
      var dy = 4 * curvature * (by - ay);

      var dst = [];

      // STRAIGHT LINE

      if (curvature == 0) {
         for (var n = 0 ; n <= N ; n++)
            dst.push([lerp(n/N, ax, bx), lerp(n/N, ay, by)]);
         return dst;
      }

      // CIRCULAR LOOP

      if (abs(curvature) == loopFlag) {
         var mx = (ax + bx) / 2, my = (ay + by) / 2;
         var rx = (ax - bx) / 2, ry = (ay - by) / 2;
         var dir = curvature > 0 ? 1 : -1;

         for (var n = 0 ; n <= N ; n++) {
            var angle = TAU * n / N;
            var c = cos(angle);
            var s = sin(angle) * dir;
            dst.push([ mx + rx * c + ry * s,
                       my - rx * s + ry * c ]);
         }
         return dst;
      }

      // OPEN CURVE

      for (var n = 0 ; n <= N ; n++) {
         var t = n / N;
         var s = lerp(abs(curvature), t, sCurve(t));
         var e = t * (1 - t);
         dst.push([lerp(s, ax, bx) - e * dy,
                   lerp(s, ay, by) + e * dx]);
      }
      return dst;
   }

   // Compute the curvature of a curved line from A to B which passes through M.

   function computeCurvature(A, M, B) {
      var dx = B[0] - A[0];
      var dy = B[1] - A[1];
      var ex = M[0] - (A[0] + B[0]) / 2;
      var ey = M[1] - (A[1] + B[1]) / 2;
      return (dx * ey - dy * ex) / (dx * dx + dy * dy);
   }

   // Return distance squared from point [x,y] to curve c.

   function dsqFromCurve(x, y, c) {
      var dsq = 100000;
      for (var i = 0 ; i < c.length - 1 ; i++)
         dsq = min(dsq, dsqFromLine(x, y, c[i], c[i+1]));
      return dsq;
   }

   // Return distance squared from point [x,y] to line segment [a->b].

   function dsqFromLine(x, y, a, b) {
      var ax = a[0] - x, ay = a[1] - y;
      var bx = b[0] - x, by = b[1] - y;
      var dx = bx - ax, dy = by - ay;
      if (ax * dx + ay * dy > 0 || bx * dx + by * dy < 0)
         return min(ax * ax + ay * ay, bx * bx + by * by);
      var aa = ax * ax + ay * ay;
      var ad = ax * dx + ay * dy;
      var dd = dx * dx + dy * dy;
      return aa - ad * ad / dd;
   }

   function getPointOnCurve(curve, t) {
      if (t <= 0) return curve[0];
      if (t >= 1) return curve[curve.length-1];
      var n = curve.length - 1;
      var i = floor(t * n);
      var f = t * n - i;
      return [ lerp(f, curve[i][0], curve[i+1][0]) ,
               lerp(f, curve[i][1], curve[i+1][1]) ];
   }

// WRAPPERS FOR DRAWING FUNCTIONS.

   var noisy = 1;
   var _nF = 0.03, _nA = 3;

   function _noise(x,y) { return noise2(x,y) + noise2(x/2,y/2) / 2; }
   function noiseX(x,y) { return _nA * _noise(_nF*x, _nF*y); }
   function noiseY(x,y) { return _nA * _noise(_nF*x, _nF*(y+128)); }

   function snx(sketch,x,y) {
      var dx = 0, dy = 0, amp = 1, seed = 0;
      if (isk() && sketch != null) {
         amp = 1 - sketch.styleTransition;
	 seed = 100 * sketch.index;
         dx = sketch.tx();
         dy = sketch.ty();
         if (sketch instanceof Sketch2D) {
            dx = sketch.x2D;
            dy = sketch.y2D;
         }
      }
      return x + amp * noiseX(x - dx, y - dy + seed);
   }
   function sny(sketch,x,y) {
      var dx = 0, dy = 0, amp = 1, seed = 0;
      if (isk() && sketch != null) {
         amp = 1 - sketch.styleTransition;
	 seed = 100 * sketch.index;
         dx = sketch.tx();
         dy = sketch.ty();
         if (sketch instanceof Sketch2D) {
            dx = sketch.x2D;
            dy = sketch.y2D;
         }
      }
      return y + amp * noiseY(x - dx, y - dy + seed);
   }

   function lineWidth(w) {
      if (isDef(w))
         _g.lineWidth = w;
      return _g.lineWidth;
   }

// OVERRIDE MOVETO AND LINETO TO ACCOMMODATE SKETCHING BEHAVIOR.

   var prev_x = 0, prev_y = 0;

   function _g_moveTo(x,y) {
      if (isDrawingSketch2D) {
         var xx = x, yy = y;
         x = sk().transformX2D(xx, yy);
         y = sk().transformY2D(xx, yy);
      }
      if (noisy <= 0) {
         _g.moveTo(x, y);
         prev_x = x;
         prev_y = y;
      }
      else 
         sketch(x, y, 0);
   }

   function _g_lineTo(x,y) {
      if (isDrawingSketch2D) {
         var xx = x, yy = y;
         x = sk().transformX2D(xx, yy);
         y = sk().transformY2D(xx, yy);
      }
      if (noisy == 0)
         _g.lineTo(x, y);
      else
         sketch(x, y, 1);
   }

// SUPPORT FOR SKETCHY DRAWING.

   function sketchStart() {
      _g.xp1 = sk().xStart;
      _g.yp1 = sk().yStart;
      _g.inSketch = true;
   }

   function sketchEnd() {
      _g.inSketch = false;
   }

   function sketchToTrace(sketch) {
      var src = sketch.sp;
      var dst = [];
      for (var i = 0 ; i < src.length ; i++)
         buildTrace(dst, src[i][0], src[i][1], src[i][2]);
      return dst;
   }

   function traceComputeBounds(trace) {
      var bounds = [];
      for (var n = 0 ; n < trace.length ; n++)
         bounds.push(strokeComputeBounds(trace[n]));
      return bounds;
   }

   function resampleTrace(src) {
      var dst = [];
      for (var n = 0 ; n < src.length ; n++)
         if (src[n].length > 1)
            dst.push(resampleStroke(src[n]));
      return dst;
   }

   function resampleStroke(src, count) {
      if (count === undefined) count = 100;

      var D = [];
      for (var i = 0 ; i < src.length ; i++)
         D.push(i == 0 ? 0 : D[i-1] + len(src[i][0]-src[i-1][0],
                                          src[i][1]-src[i-1][1]));
      var dst = [];
      dst.push([src[0][0], src[0][1]]);
      var i = 1;
      var sum = D[src.length-1];
      for (var j = 1 ; j < count ; j++) {
         var d = sum * j / count;
         while (D[i] < d && i < src.length-1)
            i++;
         var f = (d - D[i-1]) / (D[i] - D[i-1]);
         dst.push([lerp(f, src[i-1][0], src[i][0]),
                   lerp(f, src[i-1][1], src[i][1])]);
      }
      return dst;
   }

   function morphGlyphToSketch() {
      var t = min(1, 2 * sk().glyphTransition);

      if (t == 1) {
         _g.lineWidth = sketchLineWidth * .6;
         drawTrace(sk().trace);
         return;
      }

      var A = sk().glyphTrace;
      var B = resampleTrace(sk().trace);

      var s = sCurve(t);
      var C = [];
      for (var n = 0 ; n < A.length ; n++) {
         C.push([]);
         for (var i = 0 ; i < A[n].length ; i++) {
            C[C.length-1].push([ lerp(s, A[n][i][0], B[n][i][0]),
                                 lerp(s, A[n][i][1], B[n][i][1]) ]);
         }
      }

      _g.lineWidth = sketchLineWidth * lerp(t, 1, .6);
      drawTrace(C);
   }

   function drawTrace(tr) {
      _g.beginPath();
      for (var n = 0 ; n < tr.length ; n++)
         for (var i = 0 ; i < tr[n].length ; i++) {
            var x = tr[n][i][0];
            var y = tr[n][i][1];
            if (i == 0)
               _g.moveTo(x, y);
            else
               _g.lineTo(x, y);
         }
      _g.stroke();
   }

   function buildTrace(trace, x, y, isLine) {
      if (! isLine && (trace.length == 0 ||
                       trace[trace.length-1].length > 0))
         trace.push([]);

      trace[trace.length-1].push([x,y]);

      prev_x = x;
      prev_y = y;
   }

   function sketch(x, y, isLine) {
      if (! isk())
         return;

      if (isMakingGlyph) {
         if (! (sk() instanceof Sketch2D) && ! sk().is3D)
            y = -y;
         buildTrace(glyphInfo, x, y, isLine);
         return;
      }

      if (sk().glyphTrace != null) {
         if (sk().sketchState != 'finished' && sk().glyphTransition < 0.5)
            buildTrace(sk().trace, x, y, isLine);
         else {
            _g.lineWidth = sketchLineWidth * 0.6;
            if (! isLine)
               _g.moveTo(x, y);
            else
               _g.lineTo(x, y);
         }
         return;
      }

      var cx = x;
      var cy = y;
      var isPreview = sk().sketchState == 'in progress';

      if (_g.inSketch && _g.suppressSketching <= 0)
         sk().sp.push([x, y, isLine]);

      var xPrev = _g.suppressSketching > 0 ? _g.xp0 : _g.xp1;
      var yPrev = _g.suppressSketching > 0 ? _g.yp0 : _g.yp1;

      var dx = x - xPrev;
      var dy = y - yPrev;
      var d = sqrt(dx*dx + dy*dy);

      if (_g.inSketch && sk().sketchState == 'in progress'
                      && _g.suppressSketching <= 0) {
         sk().dSum += d;
         var t = sk().sketchProgress;
         if (t < sk().dSum / sk().sketchLength) {
            var dSave = d;
            d = t * sk().sketchLength - (sk().dSum - dSave);
            cx = xPrev + dx * d / dSave;
            cy = yPrev + dy * d / dSave;
            if (d > 0) {
               cursorX = cx;
               cursorY = cy;
            }
         }
      }

      if (! isLine)
         _g.moveTo(snx(sk(),cx,cy), sny(sk(),cx,cy));

      else if (d > 0) {
         for (var i = 20 ; i < d ; i += 20) {
            var xx = lerp(i/d, xPrev, cx);
            var yy = lerp(i/d, yPrev, cy);
            _g.lineTo(snx(sk(),xx,yy), sny(sk(),xx,yy));
         }
         _g.lineTo(snx(sk(),cx,cy), sny(sk(),cx,cy));
         _g.isDrawing = true;
      }
      xPrev = x;
      yPrev = y;

      if (_g.suppressSketching > 0) {
         _g.xp0 = xPrev;
         _g.yp0 = yPrev;
      }
      else {
         _g.xp1 = xPrev;
         _g.yp1 = yPrev;
      }
   }

// 2D GRAPHICS PRIMITIVES.

   function arrow(ax, ay, bx, by, r) {
      if (! isDef(r))
         r = 10;

      var angle = Math.atan2(bx - ax, by - ay);
      var x = r * Math.cos(angle), y = r * Math.sin(angle);

      _g.beginPath();
      _g_moveTo(ax, ay);
      _g_lineTo(bx, by);
      _g.stroke();

      _g_moveTo(bx - x - y, by + y - x);
      _g_lineTo(bx, by);
      _g_lineTo(bx + x - y, by - y - x);
      _g.stroke();
   }

   function line(ax, ay, bx, by) {
      _g.beginPath();
      _g_moveTo(ax, ay);
      _g_lineTo(bx, by);
      _g.stroke();
   }

   function closedCurve(c, i0) {
      curve(c.concat([c[0]]), i0);
   }

   function curve(c, i0) {
      if (i0 === undefined)
         i0 = 0;
      if (c.length <= i0)
         return;
      _g.beginPath();
      _g_moveTo(c[i0][0], c[i0][1]);
      for (var i = i0 + 1 ; i < c.length ; i++)
         _g_lineTo(c[i][0], c[i][1]);
      _g.stroke();
   }

   function color(red, grn, blu) {
      if (red === undefined)
         return _g.strokeStyle;
      _g.strokeStyle = _g.fillStyle = _color(red, grn, blu);
   }

   function fill(red, grn, blu) {
      if (red === undefined)
         return _g.fillStyle;
      _g.fillStyle = _color(red, grn, blu);
   }

   function _color(red, grn, blu) {
      return ! isDef(grn) ? red : "rgba(" + red + "," + grn + "," + blu + ",255)";
   }

   function drawPolygon(p, x, y, r, isOpen) {
      makePath(p, x, y, r, isOpen);
      _g.stroke();
   }

   function fillPolygon(p, x, y, r) {
      _g.suppressSketching++;
      makePath(p, x, y, r);
      _g.fill();
      _g.suppressSketching--;
   }

   function drawRect(x, y, w, h) {
      makeRectPath(x, y, w, h);
      _g.stroke();
   }

   function fillRect(x, y, w, h) {
      makeRectPath(x, y, w, h);
      _g.fill();
   }

   function drawOval(x, y, w, h, n, angle0, angle1) {
      makeOvalPath(x, y, w, h, n, angle0, angle1);
      _g.stroke();
   }

   function fillOval(x, y, w, h, n, angle0, angle1) {
      makeOvalPath(x, y, w, h, n, angle0, angle1);
      _g.fill();
   }

   function drawDiamond(x, y, w, h) {
      makeDiamondPath(x, y, w, h);
      _g.stroke();
   }

   function fillDiamond(x, y, w, h) {
      makeDiamondPath(x, y, w, h);
      _g.fill();
   }

   function drawOctagon(x, y, w, h) {
      makeOctagonPath(x, y, w, h);
      _g.stroke();
   }

   function fillOctagon(x, y, w, h) {
      makeOctagonPath(x, y, w, h);
      _g.fill();
   }

   function makeRectPath(x, y, w, h) {
      makePath([ [x,y],[x+w,y], [x+w,y+h], [x,y+h] ]);
   }

   function makeDiamondPath(x, y, w, h) {
      makePath([ [x,y+h/2],[x+w/2,y], [x+w,y+h/2],[x+w/2,y+h] ]);
   }

   function makeOctagonPath(x, y, w, h) {
      var x1 = x+w/4, x2 = x+3*w/4, x3 = x + w,
          y1 = y+h/4, y2 = y+3*h/4, y3 = y + h;
      makePath([ [x,y1], [x1,y], [x2,y], [x3,y1], [x3,y2], [x2,y3], [x1,y3], [x,y2] ]);
   }

   function makeOval(x, y, w, h, n, angle0, angle1) {
      if (! isDef(n))
         n = 32;
      if (! isDef(angle0))
         angle0 = 0;
      if (! isDef(angle1))
         angle1 = 2 * Math.PI;

      var xy = [];
      for (var i = 0 ; i < n ; i++) {
         var theta = angle0 + (angle1 - angle0) * i / (n-1);
         xy.push([x + w/2 - w/2 * Math.sin(theta),
                  y + h/2 - h/2 * Math.cos(theta)]);
      }
      return xy;
   }

   function makeOvalPath(x, y, w, h, n, angle0, angle1) {
      makePath(makeOval(x, y, w, h, n, angle0, angle1));
   }

   function makePath(p, x, y, r, isOpenPath) {
      if (! isDef(x)) x = 0;
      if (! isDef(y)) y = 0;
      if (! isDef(r)) r = 0;
      var n = p.length;
      _g.beginPath();
      if (r == 0) {
         _g_moveTo(x + p[0][0], y + p[0][1]);
         for (i = 1 ; i < n ; i++)
            _g_lineTo(x + p[i][0], y + p[i][1]);
         if (! isOpenPath)
            _g_lineTo(x + p[0][0], y + p[0][1]);
      }
      else {
         var s = Math.sin(r);
         var c = Math.cos(r);
         _g_moveTo(x + c*p[0][0] + s*p[0][1], y - s*p[0][0] + c*p[0][1]);
         for (i = 1 ; i < n ; i++)
            _g_lineTo(x + c*p[i][0] + s*p[i][1], y - s*p[i][0] + c*p[i][1]);
         if (! isOpenPath)
            _g_lineTo(x + c*p[0][0] + s*p[0][1], y - s*p[0][0] + c*p[0][1]);
      }
   }

   function polygonArea(P) {
      var area = 0;
      for (var i = 0 ; i < P.length ; i++) {
         var j = (i + 1) % P.length;
         area += (P[i][1] - P[j][1]) * (P[i][0] + P[j][0]) / 2;
      }
      return area;
   }

   function textWidth(str, context) {
      if (context == undefined)
         context = _g;
      return context.measureText(str).width;
   }

   function textHeight(value) {
      if (isDef(value))
         _g.textHeight = value;
      return _g.textHeight;
   }

   function text(message, x, y, alignX, alignY) {
      var th = _g.textHeight;
      if (isDrawingSketch2D) {
         var xx = x, yy = y;
         x = sk().transformX2D(xx, yy);
         y = sk().transformY2D(xx, yy);
         th *= sk().scale();
      }

      if (! isDef(alignX))
         alignX = 0;
      if (! isDef(alignY))
         alignY = 1;
      _g.font = th + 'pt ' + (isDrawingSketch2D ? 'Comic Sans MS' : 'Calibri');
      _g.fillText(message, x - alignX * textWidth(message), y + (1-alignY) * th);
   }

   function width() { return _g.canvas.width; }
   function height() { return _g.canvas.height; }

// UTILITY VARIABLES.

   var PMA = 8; // PIE MENU NUMBER OF ANGLES
   var backgroundColor = 'black';
   var bgClickCount = 0;
   var clickX = 0;
   var clickY = 0;
   var curvatureCutoff = 0.1;
   var defaultPenColor = backgroundColor == 'white' ? 'black' : 'white';
   var glyphInfo = [];
   var glyphSketch = null;
   var iOut = 0;
   var isAltPressed = false;
   var isAudioSignal= false;
   var isBottomGesture = false;
   var isCommandPressed = false;
   var isControlPressed = false;
   var isDrawingSketch2D = false;
   var isExpertMode = true;
   var isFakeMouseDown = false;
   var isKeyboardMode = false;
   var isMakingGlyph = false;
   var isMouseOverBackground = true;
   var isNumeric = false;
   var isPieMenu = false;
   var isPullDown = false;
   var isRightButtonPressed = false;
   var isRightClick = false;
   var isCodeWidget = false;
   var isShiftPressed = false;
   var isShorthandMode = false;
   var isShorthandTimeout = false;
   var isSpacePressed = false;
   var isShowingPresenterView = false;
   var isTextMode = false;
   var isTogglingExpertMode = false;
   var isTogglingMenuType = false;
   var loopFlag = 1000;
   var menuType = 0;
   var pageActionLabels = "text clone group whiteboard clear".split(' ');
   var pagePullDownLabels = pageActionLabels; // sketchTypes for the current page will be appended
   var pieMenuCode = [];
   var pieMenuCursorWeight = 0;
   var pieMenuMouseX = 0;
   var pieMenuMouseY = 0;
   var pieMenuStroke = [];
   var pieMenuStrokes = null;
   var pieMenuX = 0;
   var pieMenuXDown = 0;
   var pieMenuY = 0;
   var pieMenuYDown = 0;
   var pullDownLabels = [];
   var pullDownSelection = -1;
   var pullDownX = 0;
   var pullDownY = 0;
   var renderer = null;
   var sketchActionLabels="linking translating rotating scaling parsing deleting".split(' ');
   var sketchLabelSelection = -1;
   var sketchPadding = 10;
   var sketchToDelete = null;
   var sketchTypeLabels = [];
   var sketchTypes = [];
   var sketchAction = null;

   var codeSelector,
       codeTextArea,
       codeExample = function() {
          codeTextArea.value = codeSelector.value;
          updateF();
       },
       callTest = function(n) {
          console.log("test select " + n);
       },
       updateF = function() {
          try {
             eval(codeTextArea.value);
          } catch (e) { }
	  if (code() != null)
	     code()[codeSelector.selectedIndex][1] = codeTextArea.value;
       };

   function code() {
      return sk().code;
   }

   function codeSelectorBgColor() { return backgroundColor === 'white' ? 'white' : '#0060c0'; }
   function codeSelectorFgColor() { return backgroundColor === 'white' ? 'black' : 'white'; }
   function codeTextBgColor() { return backgroundColor === 'white' ? '#e0f0ff' : '#000040'; }
   function codeTextFgColor() { return backgroundColor === 'white' ? '#0080ff' : '#80c0ff'; }

   function toggleCodeWidget() {
      if (! isCodeWidget && ! (isk() && sk().code != null))
	 return;

      isCodeWidget = ! isCodeWidget;

      var codeElement = document.getElementById('code');
      codeElement.innerHTML = "";

      if (isCodeWidget) {
	 var options = "";
	 for (var i = 0 ; i < code().length ; i++)
	    options += "<option value='" + code()[i][1] + "'>"
	             + code()[i][0]
		     + "</option>";

         codeElement.innerHTML =
            "<select id=code_selector onchange='codeExample()'>"
	  + options
          + "</select>"
	  + "<br>"
          + "<textArea rows=40 cols=25 id=code_text"
          + " style=';outline-width:0;outline-color:black;border-style:none'"
          + " onkeyup='updateF()'>"
	  + "</textArea>";
      }

      if (isCodeWidget) {
         codeSelector = document.getElementById("code_selector");
         codeSelector.style.font="18px courier";
         codeSelector.style.visibility = code().length > 1 ? "visible" : "hidden";
         codeSelector.style.backgroundColor = codeSelectorBgColor();
         codeSelector.style.color = codeSelectorFgColor();

         codeTextArea = document.getElementById("code_text");
         codeTextArea.onchange = 'console.log("button clicked")';
         codeTextArea.style.borderColor = backgroundColor;
         codeTextArea.style.font="18px courier";
         codeTextArea.style.backgroundColor=codeTextBgColor();
         codeTextArea.style.color=codeTextFgColor();
	 codeTextArea.value= code()[codeSelector.selectedIndex][1];
	 if (code().length < 2) {
            codeTextArea.style.position = "absolute";
            codeTextArea.style.top = 0;
         }
      }
   }

   function gStart() {

      // PREVENT DOUBLE CLICK FROM SELECTING THE CANVAS:

      var noSelectHTML = ""
      + " <style type='text/css'>"
      + " canvas {"
      + " -webkit-touch-callout: none;"
      + " -webkit-user-select: none;"
      + " -khtml-user-select: none;"
      + " -moz-user-select: none;"
      + " -ms-user-select: none;"
      + " user-select: none;"
      + " outline: none;"
      + " -webkit-tap-highlight-color: rgba(255, 255, 255, 0);"
      + " }"
      + " </style>"
      ;
      var headElement = document.getElementsByTagName('head')[0];
      headElement.innerHTML = noSelectHTML + headElement.innerHTML;

      // ADD VIEWER ELEMENTS TO DOCUMENT

      var viewerHTML = ""
      + " <div id=slide width=1280 height=832 tabindex=1"
      + "    style='z-index:1;position:absolute;left:0;top:0;'>"
      + " </div>"
      + " <div id=scene_div width=1280 height=832 tabindex=1"
      + "    style='z-index:1;position:absolute;left:0;top:0;'>"
      + " </div>"
      + " <canvas id=sketch_canvas width=1280 height=832 tabindex=1"
      + "    style='z-index:1;position:absolute;left:0;top:0;'>"
      + " </canvas>"
      + " <div id=code"
      + "    style='z-index:1;position:absolute;left:0;top:0;'>"
      + " </div>"
      + " <hr id=background size=1000 color='" + backgroundColor + "'>"
      ;
      var bodyElement = document.getElementsByTagName('body')[0];
      bodyElement.innerHTML = viewerHTML + bodyElement.innerHTML;

      // INITIALIZE THE SKETCH CANVAS

      sketch_canvas.animate = function(elapsed) { sketchPage.animate(elapsed); }
      sketch_canvas.height = 832;
      sketch_canvas.keyDown = function(key) { sketchPage.keyDown(key); }
      sketch_canvas.keyUp = function(key) { sketchPage.keyUp(key); }
      sketch_canvas.mouseDown = function(x, y) { sketchPage.mouseDown(x, y); }
      sketch_canvas.mouseDrag = function(x, y) { sketchPage.mouseDrag(x, y); }
      sketch_canvas.mouseMove = function(x, y) { sketchPage.mouseMove(x, y); }
      sketch_canvas.mouseUp = function(x, y) { sketchPage.mouseUp(x, y); }
      sketch_canvas.overlay = function() { sketchPage.overlay(); }
      sketch_canvas.setup = function() {
         window.onbeforeunload = function(e) { sketchBook.onbeforeunload(e); }
         setPage(0);
      }
      sketch_canvas.width = 1280;

      fourStart();

      renderer.scene = new THREE.Scene();
      renderer.scene.add(ambientLight(0x333333));
      renderer.scene.add(directionalLight(1,1,1, 0xffffff));
       
      if (initScene != 0)
         initScene();

      var sceneElement = document.getElementById('scene_div');
      sceneElement.appendChild(renderer.domElement);

      // START ALL CANVASES RUNNING

      var c = document.getElementsByTagName("canvas");
      for (var i = 0 ; i < c.length ; i++)
          if (c[i].getAttribute("data-render") != "gl")
             startCanvas(c[i].id);
   }

   var initScene = 0, updateScene = 0, pixelsPerUnit = 97;

   function This() { return window[_g.name]; }

   function startCanvas(name) {
      if (name.length == 0)
         return;

      window.requestAnimFrame = (function(callback) {
      return window.requestAnimationFrame ||
             window.webkitRequestAnimationFrame ||
             window.mozRequestAnimationFrame ||
             window.oRequestAnimationFrame ||
             window.msRequestAnimationFrame ||
             function(callback) { window.setTimeout(callback, 1000 / 60); }; })();
      var _canvas = document.getElementById(name);
      var g = _canvas.getContext('2d');
      g.textHeight = 12;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.canvas = _canvas;
      g.name = name;
      clearSketchPage(g);

      initEventHandlers(_canvas);

      if (isDef(window[g.name].setup)) {
         _g = g;
         _g.clearRect(0, 0, _g.canvas.width, _g.canvas.height);
         This().setup();
      }

      pixelsPerUnit = 5.8 * height() / cameraFOV;

      tick(g);
   }

   var sketchType = 0;
   var pageIndex = 0;

   var sketchPalette = [
      defaultPenColor,
      'brown',
      'red',
      'orange',
      'green',
      'blue',
      'magenta',
   ];
   function paletteX(i) { return 30; }
   function paletteY(i) { return 30 + i * 30; }
   function paletteR(i) { return i == sketchPage.colorIndex ? 12 : 8; }

   function colorToRGB(colorName) {
      var R = 0, G = 0, B = 0;
      switch (colorName) {
      case 'white'  : R = 0.9; G = 0.9; B = 0.9; break;
      case 'black'  : R = 0.7; G = 0.7; B = 0.7; break;
      case 'brown'  : R = 0.5; G = 0.0; B = 0.0; break;
      case 'red'    : R = 1.0; G = 0.0; B = 0.0; break;
      case 'orange' : R = 1.0; G = 0.5; B = 0.0; break;
      case 'green'  : R = 0.0; G = 0.6; B = 0.0; break;
      case 'blue'   : R = 0.0; G = 0.0; B = 1.0; break;
      case 'magenta': R = 1.0; G = 0.0; B = 1.0; break;
      }
      return [R, G, B];
   }

   function drawPalette(context) {
      if (context == undefined)
         context = _g;

      var w = width(), h = height(), nc = sketchPalette.length;

      annotateStart(context);
      for (var n = 0 ; n < nc ; n++) {
         var x = paletteX(n);
         var y = paletteY(n);
         var r = paletteR(n);

         context.fillStyle = sketchPalette[n];
         context.beginPath();
         context.moveTo(x - r, y - r);
         context.lineTo(x + r, y - r);
         context.lineTo(x + r, y + r);
         context.lineTo(x - r, y + r);
         context.fill();
      }
      annotateEnd(context);
   }

   var sketchMenu = [
      ['a'  , "toggle audience"],
      ['b'  , "bend line"],
      ['c'  , "toggle card"],
      ['d'  , "start drawing"],
      ['e'  , "edit code"],
      ['g'  , "group/ungroup"],
      ['h'  , "home"],
      ['i'  , "insert text"],
      ['k'  , "toggle 3d box"],
      ['m'  , "toggle menu type"],
      ['n'  , "negate card color"],
      ['o'  , "output glyphs"],
      ['p'  , "pan"],
      ['r'  , "rotating"],
      ['s'  , "scaling"],
      ['t'  , "translating"],
      ['w'  , "toggle whiteboard"],
      ['x'  , "tottle expert mode"],
      ['z'  , "zoom"],
      ['-'  , "b/w <-> w/b"],
      ['spc', "show pie menu"],
      ['alt', "clone"],
      ['del', "remove last stroke"],
      [U_ARROW, "previous page"],
      [D_ARROW, "next page"],

   ];

   function Keyboard() {
      this.mx = 0;
      this.my = 0;
      this.x = 0;
      this.y = 0;
      this.key = null;
      this.keyPressed = null;
      this.mouseMove = function(x, y) {
         this.mx = x;
         this.my = y;
      }
      this.height = function() { return 3 * w / 11; }
      this.mouseDown = function(x, y) {
         path = [];
	 path.push([x,y]);
         this.keyPressed = this.key;
         return this.keyPressed != null;
      }
      this.mouseDrag = function(x, y) {
	 path.push([x,y]);
         return this.keyPressed != null;
      }
      this.mouseUp = function(x, y) {
	 path.push([x,y]);
         return this.keyPressed != null && this.key != null;
      }
      this.render = function() {
         save();
	 lineWidth(1);
         color('#444444');
	 this.key = null;
         for (var row = 0 ; row < nRows()        ; row++)
         for (var k   = 0 ; k   < rowLength(row) ; k++  ) {
            var key = keyAt(row, k);
            if (key != ' ') {
               var x = this.x + X(row, k) - w/2;
               var y = this.y + Y(row, k);
               var _x = x-s/4, _y = y-s/4, _w = W(row, k)+s/2, _h = H(row, k)+s/2;
	       if ( this.mx >= _x && this.mx < _x + _w &&
	            this.my >= _y && this.my < _y + _h ) {
                  this.key = key;
                  color('rgba(0,0,0,.25)');
                  fillRect(_x, _y, _w, _h);
                  color('#444444');
               }
               drawRect(_x, _y, _w, _h);
               switch (key) {
               case '\b': key = "del"; break; 
               case '\n': key = "ret"; break; 
               }
               text(key, x+8, y+2*s-6);
            }
         }
/*
FOR WHEN WE HAVE DRAW_PATH SHORTCUT:
	 color('red');
	 curve(path);
*/
         restore();
      }

      function keys()        { return isShiftPressed ? uc : lc; }
      function nRows()       { return keys().length;         }
      function rowLength(row){ return keys()[row].length;  }
      function keyAt(row, k) { return keys()[row].substring(k, k+1); }
      function X(row, k) { return 6*s + 3*s*k - 3*s*(3-row)/2; }
      function Y(row, k) { return 3*s*row - s - w/4; }
      function W(row, k) { x=X(row,k), r=x+3*s; return (r>w-3*s ? w-s/2 : r)-x-s; }
      function H(row, k) { return 2 * s; }
      var w = 550, s = w/45;
      var lc = ["`1234567890-=\b"," qwertyuiop[]\\"," asdfghjkl;'\n"," zxcvbnm,./"];
      var uc = ["~!@#$%^&*()_+\b"," QWERTYUIOP{}|" ,' ASDFGHJKL:"\n'," ZXCVBNM<>?"];
      var path = [];
   }

   var keyboard = new Keyboard();

   function SketchBook() {
      this.onbeforeunload = function(e) {
         if (isAudiencePopup())
            removeAudiencePopup();
      }

      this.sketchPage = function() {
         return this.sketchPages[this.page];
      }
      this.setPage = function(page) {
         this.page = page;
         if (this.sketchPages[page] === undefined)
            this.sketchPages[page] = new SketchPage();
         return this.sketchPages[page];
      }
      this.clear = function() {
         this.page = 0;
         this.sketchPages = [new SketchPage()];
      }
      this.clear();
   }

   var sketchBook = new SketchBook();

   var cloneObject = null;
   var dataColor = 'rgb(128,128,128)'
   var dataLineWidth = 2.4;
   var globalSketchId = 0;
   var group = {};
   var groupLineWidth = 8;
   var groupPath = [];
   var linkDeleteColor = 'rgba(255,0,0,.1)';
   var linkHighlightColor = 'rgba(0,192,96,.2)';
   var overlayColor = 'rgb(0,64,255)';
   var overlayScrim = 'rgba(0,64,255,.25)';
   var portColor = 'rgb(0,192,96)';
   var portBgColor = backgroundColor;
   var portHeight = 24;
   var portHighlightColor = 'rgb(192,255,224)';
   var sketchLineWidth = 4;

   function addSketchOfType(i) {
      eval("addSketch(new " + sketchTypes[i] + "())");
   }

   function registerSketch(type) {

      // CREATE A TEMPORARY INSTANCE OF THIS SKETCH TYPE.

      eval("addSketch(new " + type + "())");
      sketchTypeLabels.push(sk().labels);

      // RENDER EACH OF ITS SELECTIONS ONCE TO CREATE GLYPH INFO.

      for (var n = 0 ; n < sk().labels.length ; n++) {
         sk().setSelection(sk().labels[n]);

         // CREATE GLYPH SHAPE INFO.

         glyphInfo = [];
         isMakingGlyph = true;
         sk().render(0.02);
         isMakingGlyph = false;

         // REGISTER THE GLYPH.

         var code = "sg('" + type + "','" + sk().labels[n] + "')";
         registerGlyph(code, glyphInfo);
      }

      // FINALLY, DELETE THE SKETCH.

      deleteSketch(sk());
   }

   // CREATE AN INSTANCE OF A REGISTERED SKETCH TYPE.

   function sg(type, selection) {
      var bounds = strokeComputeBounds(glyphSketch.sp, 1);
      This().mouseX = (bounds[0] + bounds[2]) / 2;
      This().mouseY = (bounds[1] + bounds[3]) / 2;

      eval("addSketch(new " + type + "())");

      sk().width = bounds[2] - bounds[0];
      sk().height = bounds[3] - bounds[1];
      sk().setSelection(selection);
      sk().glyphTrace = resampleTrace(sketchToTrace(glyphSketch));
      sk().glyphTransition = 0;
      sk().trace = [];

      sk().size = sk().height * 2;

      if (sk().computeStatistics != null)
         sk().computeStatistics();
   }

   function drawGroupPath(groupPath) {
      if (groupPath == null)
         return;
      color('rgba(255,1,0,.3)');
      lineWidth(groupLineWidth);
      _g.beginPath();
      for (var i = 0 ; i < groupPath.length ; i++) {
         var x = groupPath[i][0];
         var y = groupPath[i][1];
         if (i == 0)
            _g.moveTo(x,y);
         else
            _g.lineTo(x,y);
      }
      _g.stroke();
   }

   function drawPieMenu(x0, y0) {
      var w = width(), h = height();
      var R = 130, r = 30;
      
      if (x0 === undefined) x0 = w / 2;
      if (y0 === undefined) y0 = h / 2;

      var mouseX = This().mouseX;
      var mouseY = This().mouseY;

      if (sketchPage.isPressed) {
         var r0 = len(pieMenuMouseX - x0, pieMenuMouseY - y0);
         if (r0 < R - r/2) {
            var r1 = len(mouseX - x0, mouseY - y0);
            if (r1 > r0) {
               pieMenuMouseX = mouseX;
               pieMenuMouseY = mouseY;
            }
         }
         else {
            mouseX = pieMenuMouseX;
            mouseY = pieMenuMouseY;
         }
      }

      var P = [];
      var choice = -1;
      for (var n = 0 ; n < PMA ; n++) {
         var theta = TAU * n / PMA;
         P.push([x0 + R * cos(theta), y0 - R * sin(theta)]);
         if (len(P[n][0] - mouseX, P[n][1] - mouseY) < r)
            choice = n;
      }

      lineWidth(1);
      textHeight(10);

      if (choice >= 0) {
         color('blue');
         fillOval(x0 - 4, y0 - 4, 8, 8);
      }
      for (var n = 0 ; n < PMA ; n++) {
         color('blue');
         if (choice < 0)
            line(x0, y0, P[n][0], P[n][1]);
         else if (choice == 0) {
            if (n < pageActionLabels.length) {
               line(P[0][0], P[0][1], P[n][0], P[n][1]);
               color('rgba(0,0,255,0.2)');
               line(x0, y0, P[n][0], P[n][1]);
            }
         }
         else if (choice-1 < sketchTypeLabels.length) {
            if ((n - choice + PMA) % PMA < sketchTypeLabels[choice-1].length) {
               line(P[choice][0], P[choice][1], P[n][0], P[n][1]);
               color('rgba(0,0,255,0.2)');
               line(x0, y0, P[n][0], P[n][1]);
            }
         }
      }

      var str;
      for (var n = 0 ; n < PMA ; n++) {
         color(n == choice ? 'rgba(0,0,255,0.05)' : backgroundColor);
         fillOval(P[n][0] - r, P[n][1] - r, r+r, r+r);
         color('blue');
         drawOval(P[n][0] - r, P[n][1] - r, r+r, r+r);

         if (choice < 0)
            str = (n == 0 ? "page" : sketchTypes[n-1]);
         else if (choice == 0)
            str = pageActionLabels[n];
         else if (choice-1 < sketchTypeLabels.length)
            str = sketchTypeLabels[choice-1][(n - choice + PMA) % PMA];

         if (isDef(str))
            text(str, P[n][0], P[n][1], .5, .5);
      }
   }

   function computeLinkCurvature(link, C) {
      var a = link[0];
      var i = link[1];
      var b = link[3][0];
      var j = link[3][1];
      link[3][2] = computeCurvature(a.portXY(i), C, b.portXY(j));
      link[3][3] = undefined;
   }

   function drawLink(a, i, linkData, isVisible) {
      var b = linkData[0];
      var j = linkData[1];
      var s = linkData[2];

      var A = a.portXY(i), ax = A[0], ay = A[1];
      var B = b.portXY(j), bx = B[0], by = B[1];

      var aR = a.portName.length > 0 ? a.portBounds[i] : [a.xlo,a.ylo,a.xhi,a.yhi];
      var bR = b.portName.length > 0 ? b.portBounds[j] : [b.xlo,b.ylo,b.xhi,b.yhi];

      // ONLY RECOMPUTE LINK SHAPE WHEN NECESSARY.

      var status = [ax,ay,bx,by,s, aR[0],aR[1],aR[2],aR[3], bR[0],bR[1],bR[2],bR[3]];
      if (! isEqualArray(status, linkData[3])) {
         linkData[3] = status;

         linkData[4] = createCurve(A, B, s);

         function clipCurveAgainstRect(src, R) {
            var dst = [];
            var x1 = src[0][0];
            var y1 = src[0][1];
            if (! isInRect(x1,y1, R))
               dst.push([x1,y1]);
            for (var n = 1 ; n < src.length ; n++) {
               var x0 = x1, y0 = y1;
               x1 = src[n][0];
               y1 = src[n][1];
               var draw0 = ! isInRect(x0,y0, R);
               var draw1 = ! isInRect(x1,y1, R);
               if (draw0 || draw1) {
                  if (! draw0)
                     dst.push(clipLineToRect(x0,y0, x1,y1, R));
                  if (! draw1)
                     dst.push(clipLineToRect(x1,y1, x0,y0, R));
                  else
                     dst.push([x1,y1]);
               }
            }
            return dst;
         }

         linkData[4] = clipCurveAgainstRect(linkData[4], aR);
         linkData[4] = clipCurveAgainstRect(linkData[4], bR);
      }

      if (isVisible) {
         lineWidth(dataLineWidth);
         color(dataColor);
         var C = linkData[4];
         for (var n = 0 ; n < C.length-1 ; n++)
            if (n < C.length-2)
               line(C[n][0], C[n][1], C[n+1][0], C[n+1][1]);
            else
               arrow(C[n][0], C[n][1], C[n+1][0], C[n+1][1]);

         if (b.portName.length == 0 && ! b.isNullText()) {
            var cx = (ax + bx) / 2 + (ay - by) * s;
            var cy = (ay + by) / 2 + (bx - ax) * s;
            color(backgroundColor);
            fillOval(cx - 10, cy - 10, 20, 20);
            color(dataColor);
            text(j==0 ? "x" : j==1 ? "y" : "z", cx, cy, .5, .6);
            lineWidth(1);
            drawOval(cx - 10, cy - 10, 20, 20);
         }
      }
   }

   function drawPossibleLink(s, x, y) {
      lineWidth(dataLineWidth);
      color(dataColor);
      var xy = s.portXY(outPort);
      arrow(xy[0], xy[1], x, y);
   }

   function findOutSketchAndPort() {
      outSketch = isHover() ? sk() : null;
      outPort = -1;
      if (outSketch != null) {
         outPort = findPortAtCursor(outSketch);
         inSketch = null;
         inPort = -1;
      }
   }

   function findInSketchAndPort() {
      inSketch = null;
      inPort = -1;
      for (var I = nsk() - 1 ; I >= 0 ; I--)
         if (isLinkTargetSketch(sk(I))) {
            if ((inPort = findNearestInPort(sk(I))) >= 0)
               inSketch = sk(I);
            break;
         }
   }

   function isLinkTargetSketch(s) {
      return s != outSketch && s.parent == null
                            && s.contains(sketchPage.mx, sketchPage.my);
   }

   function finishDrawingUnfinishedSketch() {
      if (! isPullDown && isk()
                           && ! isHover()
                           && sk().sketchState != 'finished') {
         sk().sketchProgress = 1;
         sk().cursorTransition = 1;
         sk().styleTransition = 1;
         sk().sketchState = 'finished';
      }
   }

   function isFinishedDrawing() {
      return isk() && sk().sketchState == 'finished';
   }

   function isMouseNearCurve(c) {
      return dsqFromCurve(This().mouseX, This().mouseY, c) < 10 * 10;
   }

   function moveChildren(children, dx, dy) {
      for (var i = 0 ; i < children.length ; i++) {
         children[i].tX += dx;
         children[i].tY += dy;
         children[i].textX += dx;
         children[i].textY += dy;
         if (children[i] instanceof Sketch2D) {
            children[i].x2D += dx;
            children[i].y2D += dy;
         }
      }
   }

   function deleteLinkAtCursor() {
      var a = linkAtCursor[0];
      var i = linkAtCursor[1];
      var k = linkAtCursor[2];
      var b = linkAtCursor[3][0];
      var j = linkAtCursor[3][1];

      deleteOutLink(a, i, k);
      deleteInLink(b, j);
   }

   function deleteOutLink(s, i, k) {
      s.out[i].splice(k, 1);
      if (s.out[i].length == 0)
         s.outValue[i] = undefined;
   }

   function deleteInLink(s, j) {
      s.in[j] = undefined;
      s.inValue[j] = undefined;
      if (s instanceof SimpleSketch && s.isNullText() && s.sp0.length <= 1)
         deleteSketch(s);
   }

   function kbd() {
      isKeyboardMode = ! isKeyboardMode;
      console.log("isKeyboardMode = " + isKeyboardMode);
   }

   function isKeyboard() {
      return isKeyboardMode && isTextMode;
   }

   function setTextMode(state) {
      isTextMode = state;
      return isTextMode;
   }

   function toggleTextMode(sketch) {
      if (setTextMode(! isTextMode)) {
         isShiftPressed = false;
         if (sketch === undefined) {
            addSketch(new SimpleSketch());
            sketchPage.textInputIndex = sketchPage.index;
            sk().sketchProgress = 1;
            sk().sketchState = 'finished';
            sk().textX = sk().tX = This().mouseX;
            sk().textY = sk().tY = This().mouseY;
         }
         else if (sk().text.length == 0) {
            sketch.textX = sk().tx();
            sketch.textY = sk().ty();
         }
      }
   }

   // CREATE PROPER SEMANTIC LABELING OF A STROKE.

   function parseStrokes(strokes, sketch) {

      // BUILD STATISTICS FOR EACH STROKE.

      var enableSymmetry = [true,true];

      var stats = [];
      for (var n = 0 ; n < strokes.length ; n++) {
         var s = strokes[n];
         var a = s[0], b = s[s.length-1], m = s[floor(s.length/2)];

         // HANDLE LOOPS

         if (distance(a, b) < 20) {

            // ALIGN WITH EITHER THE X OR Y COORDINATE.

            var c = [ (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 ];
            var p = [m[0], m[1]];
            var i = abs(p[0] - c[0]) < abs(p[1] - c[1]) ? 0 : 1;
            p[i] = c[i];
            enableSymmetry[1-i] = false;

            var aa = s[floor(s.length/4)];
            var bb = s[floor(s.length*3/4)];
            var ux = b[0] - a[0], uy = b[1] - a[1];
            var vx = bb[0] - aa[0], vy = bb[1] - aa[1];
            var dir = ux * vy < uy * vx ? 1 : -1;

            stats.push([a, p, dir * loopFlag]);
         }
         else
            stats.push([a, b, computeCurvature(a, m, b)]);
      }

      // ALIGN X,Y COORDS OF STROKE ENDPOINTS WHERE POSSIBLE.

      for (var n = 0 ; n < stats.length ; n++)

         // FOR EACH OF THE STROKE'S TWO ENDPOINTS:

         for (var i = 0 ; i < 2 ; i++) {

            // FIND ALL POINTS WITH AN X OR Y COORDINATE NEAR THIS ONE,

            var p = stats[n][i];
            var eq = [ [] , [] ];
            for (m = 0 ; m < stats.length ; m++)
               for (var j = 0 ; j < 2 ; j++) {
                  var q = stats[m][j];
                  for (var a = 0 ; a < 2 ; a++) {
                     var da = abs(p[ a ] - q[ a ]);
                     var db = abs(p[1-a] - q[1-a]);
                     if (da < 20 || da < db / 10)
                        eq[a].push([m,j]);
                  }
               }

            // THEN SET ALL THOSE COORDINATES TO THEIR AVERAGE VALUE.

            for (var a = 0 ; a < 2 ; a++)
               if (eq[a].length > 1) {
                  var avg = 0;
                  for (var k = 0 ; k < eq[a].length ; k++) {
                     var e = eq[a][k];
                     avg += stats[e[0]][e[1]][a];
                  }
                  avg /= eq[a].length;
                  for (var k = 0 ; k < eq[a].length ; k++) {
                     var e = eq[a][k];
                     stats[e[0]][e[1]][a] = floor(avg + 0.5);
                  }
               }
         }
            
      // FIND ALL THE COORDS AND SORT THEM.

      var xs = new Set();
      var ys = new Set();
      for (var n = 0 ; n < stats.length ; n++)
         for (var u = 0 ; u < 2 ; u++) {
            xs.add(stats[n][u][0]);
            ys.add(stats[n][u][1]);
         }

      xs.sort(function(a,b) { return a>b; });
      ys.sort(function(a,b) { return a>b; });

      // SORT ALL POINTS.

      var xys = new Set();
      for (var n = 0 ; n < stats.length ; n++)
         for (var u = 0 ; u < 2 ; u++)
            xys.add(stats[n][u]);

      xys.sort(function(a,b) { return a[0]<b[0] ? -1 : a[0]>b[0] ? 1 : a[1]-b[1]; });

      var points = [];
      for (var i = 0 ; i < xys.length ; i++)
         points.push([ xs.indexOf(xys[i][0]) , ys.indexOf(xys[i][1]) ]);

      // LABEL ALL THE LINES, AND ARRANGE THEM IN SORTED ORDER.

      var lines = [];
      for (var n = 0 ; n < stats.length ; n++) {
         var s = stats[n];
         var a = xys.indexOf(s[0]);
         var b = xys.indexOf(s[1]);
         var c = abs(s[2]) == loopFlag ? s[2] :
                 s[2] <= -curvatureCutoff ? -1 : s[2] >= curvatureCutoff ? 1 : 0;

         if (a == b && c == 0)
            continue; // IGNORE DEGENERATE LINES.

         if (a > b) {
            var tmp = a;
            a = b;
            b = tmp;
            c = -c;
         }

         lines.push([a, b, c]);
      }

      lines.sort(function(a,b) { return a[0]<b[0] ? -1 :
                                        a[0]>b[0] ?  1 :
                                        a[1]!=b[1] ? a[1]-b[1] : a[2]-b[2] ; });

      // ENFORCE BILATERAL SYMMETRY.

      if (enableSymmetry[0] && xs.length == 3)
         xs[1] = (xs[0] + xs[2]) / 2;

      if (enableSymmetry[1] && ys.length == 3)
         ys[1] = (ys[0] + ys[2]) / 2;

      // PACKAGE UP ALL THE PARSED DATA.

      return [ [ xs , ys ] , points , lines ];
   }

   // SEGMENT A STROKE BASED ON WHERE IT HAS SHARP BENDS.

   function segmentStroke(src, i0) {
      if (i0 === undefined)
         i0 = 0;

      // IF SRC POINTS ARE TOO CLOSELY SPACED, SKIP OVER SOME.

      var stroke = [];
      var i = i0;
      for (var j = i ; j < src.length ; j++) {
         var dx = src[j][0] - src[i][0];
         var dy = src[j][1] - src[i][1];
         if (j == i0 || len(dx, dy) > 2) {
            stroke.push([src[j][0],src[j][1]]);
            i = j;
         }
      }

      // COMPUTE DIRECTIONS BETWEEN SUCCESSIVE POINTS.

      function Dx(j) { return directions[j][0]; }
      function Dy(j) { return directions[j][1]; }

      var directions = [];
      for (var i = 1 ; i < stroke.length ; i++) {
         var dx = stroke[i][0] - stroke[i-1][0];
         var dy = stroke[i][1] - stroke[i-1][1];
         var d = len(dx, dy);
         directions.push([dx / d, dy / d]);
      }

      // WHEREVER STROKE BENDS, SPLIT INTO A NEW SUBSTROKE.

      var dst = [];
      for (var j = 0 ; j < directions.length ; j++) {
         if (j==0 || (Dx(j-1) * Dx(j) + Dy(j-1) * Dy(j) < 0.5))
            dst.push([]);
         dst[dst.length-1].push([stroke[j][0],stroke[j][1]]);
      }

      // DISCARD ALL SUBSTROKES THAT ARE TOO SMALL.

      for (var n = dst.length - 1 ; n >= 0 ; n--) {
         var a = dst[n][0];
         var m = dst[n][floor(dst[n].length / 2)];
         var b = dst[n][dst[n].length - 1];
         if (max(distance(a,m),max(distance(m,b),distance(a,b))) < 10)
            dst.splice(n, 1);
      }

      // RETURN ARRAY OF SUBSTROKES.

      return dst;
   }

   var strokes = [];
   var strokesStartTime = 0;
   var textGlyph = null;

   function interpretStrokes() {
      if (strokes.length == 0 || strokes[0].length < 2) {
         strokes = [];
         return null;
      }

      textGlyph = new Glyph("", strokes);
      strokes = [];

      if (isCreatingTextGlyphData)
         console.log(textGlyph.toString());

      var bestMatch = 0;
      var bestScore = 10000000;
      for (var i = 0 ; i < glyphs.length ; i++) {
         var score = textGlyph.compare(glyphs[i]);
         if (score < bestScore) {
            bestScore = score;
            bestMatch = i;
         }
      }

      return glyphs[bestMatch];
   }

   var shRadius = 16; // radius of shorthand inner region

   function interpretShorthand() {
      var stroke = strokes[0];
      var n = stroke.length;
      if (len(stroke[n-1][0] - stroke[0][0],
              stroke[n-1][1] - stroke[0][1]) < shRadius) {
         if (iOut < n - 5)
            sketchPage.handleDrawnTextChar(interpretShorthandSegment(stroke, iOut, n));
         iOut = n;
      }
   }

   function interpretShorthandSegment(stroke, i0, i1) {
      var x = 0, y = 0;
      for (var i = i0 ; i < i1 ; i++) {
         x += stroke[i][0] - stroke[0][0];
         y += stroke[i][1] - stroke[0][1];
      }
      var angle = atan2(-y, x);
      var c = cos(angle), s = sin(angle);

      var xx = 0;
      var yy = 0;
      var sgn = 0;

      var iMean = (i0 + i1-1) / 2;
      for (var i = i0 ; i < i1 ; i++) {
         var x1 = stroke[i][0] - stroke[0][0];
         var y1 = stroke[i][1] - stroke[0][1];

         var x2 = x1 * c - y1 * s;
         var y2 = x1 * s + y1 * c;

         xx += x2 * x2;
         yy += y2 * y2;
         sgn += y2 > 0 == i > iMean ? 1 : -1;
      }

      var ratio = xx / yy;
      var shape = ratio <  10 ? sgn < 0 ? 0 : 4
                : ratio < 100 ? sgn < 0 ? 1 : 3
                : 2;

      var n = floor(8 * angle / TAU + 8.5) % 8;
      var text = lookupChar(n, shape);

      switch (text) {
      case R_ARROW: return " ";
      case L_ARROW: return "del";
      case U_ARROW: isShiftPressed = ! isShiftPressed; return null;
      case 'N': isNumeric = ! isNumeric; return null;
      case D_ARROW: return "ret";
      }

      return text;
   }

   function lookupChar(n, shape) {
      n = shape + 5 * n;
      var ch = shorthandDictionary.substring(n, n+1);
      switch (ch) {
      case ' ': ch = ''; break;
      case 'C': ch = U_ARROW; break;
      case 'D': ch = L_ARROW; break;
      case 'R': ch = D_ARROW; break;
      case 'S': ch = R_ARROW; break;
      }
      return ch;
   }

   var shorthandDictionary = ""
      + "klSm."
      + "}nop~"
      + "qrCsN"
      + "/tuv{"
      + "wxDyz"
      + " Rab "
      + "cdefg"
      + " hij "
   ;

   function strokeComputeBounds(src, i0) {
      if (i0 === undefined) i0 = 0;
      var xlo = 10000, ylo = xlo, xhi = -xlo, yhi = -ylo;
      for (var n = 0 ; n < src.length ; n++) {
         xlo = min(xlo, src[n][0]);
         ylo = min(ylo, src[n][1]);
         xhi = max(xhi, src[n][0]);
         yhi = max(yhi, src[n][1]);
      }
      return [xlo,ylo,xhi,yhi];
   }

   function strokesComputeBounds(src, i0) {
      if (i0 === undefined) i0 = 0;
      var xlo = 10000, ylo = xlo, xhi = -xlo, yhi = -ylo;
      for (var n = 0 ; n < src.length ; n++)
         for (var i = i0 ; i < src[n].length ; i++) {
            xlo = min(xlo, src[n][i][0]);
            ylo = min(ylo, src[n][i][1]);
            xhi = max(xhi, src[n][i][0]);
            yhi = max(yhi, src[n][i][1]);
         }
      return [xlo,ylo,xhi,yhi];
   }

   function strokesNormalize(src) {
      var B = strokesComputeBounds(src);
      var cx = (B[0] + B[2]) / 2;
      var cy = (B[1] + B[3]) / 2;
      var scale = 1 / max(B[2] - B[0], B[3] - B[1]);
      var dst = [];
      for (var n = 0 ; n < src.length ; n++) {
         dst.push([]);
         for (var i = 0 ; i < src[n].length ; i++)
            dst[n].push([ (src[n][i][0] - cx) * scale,
                          (src[n][i][1] - cy) * scale ]);
      }
      return dst;
   }

   function registerGlyph(name, strokes) {
       glyphs.push(new Glyph(name, strokes));
   }

   function Glyph(name, src) {

      this.name = name;
      this.data = [];

      if (src.length > 0 && typeof(src[0]) == 'string') {
         for (var n = 0 ; n < src.length ; n++) {
            this.data.push([]);
            for (var i = 0 ; i < src[n].length ; i += 2)
               this.data[n].push([ 100 * ef.decode(src[n].substring(i,i+1)),
                                   100 * ef.decode(src[n].substring(i+1,i+2)) ]);
         }
         return;
      }

      var N = 100;

      // MOVE AND SCALE STROKES TO FIT WITHIN A UNIT SQUARE.

      var strokes = strokesNormalize(src);

      for (var n = 0 ; n < strokes.length ; n++) {

         // RESCALE EACH STROKE TO FIT WITHIN A 100x100 PIXEL SQUARE.

         var stroke = strokes[n];
         for (var i = 0 ; i < stroke.length ; i++) {
            stroke[i][0] = 50 + 100 * stroke[i][0];
            stroke[i][1] = 50 + 100 * stroke[i][1];
         }

         // COMPUTE FRACTIONAL LENGTHS ALONG STROKE.

         var ns = stroke.length;

         var f = [0], sum = 0;
         for (var i = 1 ; i < ns ; i++)
             f.push(sum += len(stroke[i][0] - stroke[i-1][0],
                               stroke[i][1] - stroke[i-1][1]));
         for (var i = 0 ; i < ns ; i++)
             f[i] /= sum;

         // RESAMPLE TO 100 EQUAL-LENGTH SAMPLES.

         this.data.push([]);
         var i = 0;
         for (var j = 0 ; j < N ; j++) {
            var t = j / (N-1);
            while (i < ns && f[i] <= t)
               i++;
            if (i == ns) {
               this.data[n].push([stroke[ns-1][0], stroke[ns-1][1]]);
               break;
            }
            var u = (t - f[i-1]) / (f[i] - f[i-1]);
            this.data[n].push([lerp(u, stroke[i-1][0], stroke[i][0]),
                               lerp(u, stroke[i-1][1], stroke[i][1])]);
         }
      }

      this.toString = function() {
         var str = '"' + this.name + '",\n';
         str += '[';
         for (var n = 0 ; n < this.data.length ; n++) {
            str += '"';
            for (var i = 0 ; i < this.data[n].length ; i++)
               str += ef.encode(this.data[n][i][0] / 100)
                    + ef.encode(this.data[n][i][1] / 100);
            str += '",';
         }
         str += '],';
         return str;
      }

      this.compare = function(other) {
         if (this.data.length != other.data.length)
            return 1000000;
         var score = 0;
         for (var n = 0 ; n < this.data.length ; n++)
            for (var i = 0 ; i < this.data[n].length ; i++) {
               var dx = this.data[n][i][0] - other.data[n][i][0];
               var dy = this.data[n][i][1] - other.data[n][i][1];
               score += dx * dx + dy * dy;
            }
         return score;
      }
   }

   var isCreatingTextGlyphData = false;

   function shift(textChar) {
      if (isShiftPressed && textChar.length == 1) {
         var ch = textChar.charCodeAt(0);
         textChar = String.fromCharCode(ch - 32);
      }
      else if (isNumeric && textChar.length == 1) {
         var ch = textChar.charCodeAt(0);
         textChar = String.fromCharCode(ch - 64);
      }
      return textChar;
   }

   // ZOOM AND PAN X

   function zpx(x) {
      x -= width()/2;
      x *= sketchPage.zoom;
      x += sketchPage.panX;
      x += width()/2;
      return x;
   }

   // ZOOM AND PAN Y

   function zpy(y) {
      y -= height()/2;
      y *= sketchPage.zoom;
      y += sketchPage.panY;
      y += height()/2;
      return y;
   }

   // INVERSE ZOOM AND PAN X

   function izpx(x) {
      x -= width()/2;
      x -= sketchPage.panX;
      x /= sketchPage.zoom;
      x += width()/2;
      return x;
   }

   // INVERSE ZOOM AND PAN Y

   function izpy(y) {
      y -= height()/2;
      y -= sketchPage.panY;
      y /= sketchPage.zoom;
      y += height()/2;
      return y;
   }

   function doAction(x, y) {
      if (bgClickCount != 1 || ! isHover())
         return false;

      // IF AFTER A CLICK OVER THE BACKGROUND, DO SPECIAL ACTIONS:

      bgClickCount = 0;
      var dx = x - clickX;
      var dy = y - clickY;

      var compassPoint = floor(8 * atan2(dy, dx) / TAU + 4.5) %  8;
      switch (compassPoint) {
      case 0:
         sk().fadeAway = 1;             // E -- FADE TO DELETE
         break;
      case 2:
         sketchAction = "rotating";     // S -- ROTATE
         break;
      case 3:
         toggleTextMode();              // SW -- TOGGLE TEXT MODE
         break;
      case 4:
         sketchAction = "scaling";      // W -- SCALE
         break;
      case 5:
         copySketch(sk());              // NW -- CLONE
         sketchAction = "translating";
         break;
      case 6:
         sketchAction = "translating";  // N -- TRANSLATE
         break;
      }

      return true;
   }

   function Choice() {
      this.weights = [];
      this.set = function(n) {
         this.value = n;
         this.update();
      }
      this.get = function(i) {
         return sCurve(this.weights[i]);
      }
      this.update = function(delta) {
         if (delta === undefined)
	    delta = 0;

         while (this.weights.length <= this.value)
            this.weights.push(0);

         for (var i = 0 ; i < this.weights.length ; i++)
            this.weights[i] =
               i == this.value ? min(1, this.weights[i] + 2 * delta)
                               : max(0, this.weights[i] - delta);
      }
      this.set(0);
   }

   function SketchPage() {
      this.fadeAway = 0;
      this.sketches = [];

      this.createTextSketch = function(text) {
         this.keyDown(64 + 9);            // enter text insertion mode
         this.keyUp(64 + 9);
         for (var i = 0 ; i < text.length ; i++) {
            var charCode = text.charCodeAt(i);
            this.keyDown(charCode);
            this.keyUp(charCode);
         }
         this.keyDown(27);                // exit text insertion mode
         this.keyUp(27);
         return sk();
      }
      this.createLink = function() {

         // AVOID CREATING DUPLICATE LINKS.

         if (inPort < inSketch.in.length && inSketch.in[inPort] != undefined
                                         && inSketch.in[inPort][0] == outSketch
                                         && inSketch.in[inPort][1] == outPort )
             return;

         // IF NO OUTPUT SLOTS YET, CREATE EMPTY ARRAY OF OUTPUT SLOTS.

         if (outPort >= outSketch.out.length || outSketch.out[outPort] === undefined)
            outSketch.out[outPort] = [];

         outSketch.out[outPort].push([inSketch,inPort,0]);
         inSketch.in[inPort] = [outSketch,outPort];
      }

      this.clear = function() {
         this.colorIndex = 0;
         this.index = -1;
         this.isWhiteboard = false;
         this.mx = 0;
         this.my = 0;
	 while (this.sketches.length > 0)
	    deleteSketch(this.sketches[0]);
         this.textInputIndex = -1;
	 if (renderer != null) {
            renderer.scene.remove(root);
	    initScene();
         }
      }
      this.clear();

      this.findIndex = function(sketch) {
         for (var i = 0 ; i < this.sketches.length ; i++)
            if (this.sketches[i] == sketch)
               return i;
         return -1;
      }

      this.add = function(sketch) {
         this.sketches.push(sketch);
         this.index = this.sketches.length - 1;
         sketch.index = this.index;
         pullDownLabels = sketchActionLabels.concat(sketch.labels);
      }

      this.isCreatingGroup = false;

      this.isFocusOnLink = false;

      // HANDLE MOUSE DOWN FOR THE SKETCH PAGE.

      this.mouseDown = function(x, y) {

         if (isKeyboard() && keyboard.mouseDown(x,y)) {
	    return;
	 }

         if (bgClickCount == 1)
	    return;

         if (y >= height() - 50) {
            isBottomGesture = true;
            this.xDown = x;
            return;
         }

         if (x >= width() - 50 && y < 50) {
            isTogglingExpertMode = true;
            return;
         }

         if (x >= width() - 50 && y >= height() - 50) {
            isTogglingMenuType = true;
            return;
         }

         this.isPressed = true;
         this.isClick = true;
         this.isPossibleClickOverBackground = ! isHover();
         this.travel = 0;
         this.xDown = x;
         this.yDown = y;
         this.x = x;
         this.y = y;

         if (isPieMenu) {
            pieMenuStroke = [[x,y]];
            return;
         }

         if (isTextMode) {
            strokes = [[[x,y]]];
            strokesStartTime = time;
            isShorthandMode = true;
            isShorthandTimeout = false;
            iOut = 0;
            return;
         }

         if (isShowingTimeline) {
            isDraggingTimeline = true;
            console.log("timeline down");
            return;
         }

         // BEFORE PROCEEDING, FINISH ANY UNFINISHED SKETCH.

         finishDrawingUnfinishedSketch();

         this.isFocusOnLink = false;
         if (linkAtCursor != null) {
            this.isFocusOnLink = true;
            return;
         }

         if (this.isCreatingGroup)
            return;

         // SEND MOUSE DOWN/DRAG COMMANDS TO AN EXISTING SKETCH.

         this.isFocusOnSketch = false;
         if (isk() && sk().isMouseOver) {
            if (sk().sketchProgress == 1) {
               this.isFocusOnSketch = ! (sk() instanceof SimpleSketch) || sk().isGroup();
               sk().isPressed = true;
               sk().isClick = true;
               sk().travel = 0;
               sk().xDown = x;
               sk().yDown = y;
               sk().x = x;
               sk().y = y;
            }
            if (outPort == -1 || sk() instanceof Number)
               sk().mouseDown(x, y);
         }

         // START TO DRAW A NEW SIMPLE SKETCH.

         else {
            addSketch(new SimpleSketch());
            sk().sketchProgress = 1;
            sk().sketchState = 'finished';
            sk().mouseDown(x, y);
         }
      }

      // HANDLE MOUSE DRAG FOR THE SKETCH PAGE.

      this.mouseDrag = function(x, y) {

         if (isKeyboard() && keyboard.mouseDrag(x,y)) {
	    return;
	 }

         if (bgClickCount == 1)
	    return;

         if (isBottomGesture)
            return;

         if (isTogglingExpertMode)
            return;

         if (isTogglingMenuType)
            return;

         this.travel += len(x - this.x, y - this.y);
         this.x = x;
         this.y = y;

         if (isPieMenu) {
            pieMenuStroke.push([x, y]);
            return;
         }

         if (isTextMode) {
            if ( ! isShorthandTimeout &&
                 len(x - strokes[0][0][0], y - strokes[0][0][1]) >= shRadius )
               isShorthandMode = false;

            strokes[0].push([x, y]);

            if (isShorthandMode)
               interpretShorthand();

            return;
         }

         if (isDraggingTimeline) {
            console.log("timeline drag");
            return;
         }

         if (this.isFocusOnLink) {
            if (linkAtCursor != null)
               computeLinkCurvature(linkAtCursor, [x, y]);
            return;
         }

         if (this.isCreatingGroup)
            return;

         if (isk() && (outPort == -1 || sk() instanceof Number)) {
            if (sk().sketchProgress == 1) {
               sk().travel += len(x - sk().x, y - sk().y);
               if (sk().travel > 10)
                  sk().isClick = false;
               sk().x = x;
               sk().y = y;
            }
            sk().mouseDrag(x, y);
         }
      }

      // HANDLE MOUSE UP FOR THE SKETCH PAGE.

      this.mouseUp = function(x, y) {

         if (isKeyboard() && keyboard.mouseUp(x,y)) {
	    this.handleTextChar(keyboard.key);
	    return;
	 }

         if (isBottomGesture) {
            isBottomGesture = false;
	    if (y < height() - 100)
	       clearSketchPage();
            else if (x < this.xDown - 100)
               setPage(pageIndex - 1);
            else if (x > this.xDown + 100)
               setPage(pageIndex + 1);
            return;
	 }

         if (isTogglingExpertMode) {
            isTogglingExpertMode = false;
            isExpertMode = ! isExpertMode;
            return;
         }

         if (isTogglingMenuType) {
            isTogglingMenuType = false;
            menuType = (menuType + 1) % 2;
            return;
         }

         this.isPressed = false;
         this.isClick = this.travel < 10;

         if (isPieMenu) {
            endPieMenu();
            return;
         }

         // SPECIAL HANDLING FOR TEXT MODE.

         if (isTextMode) {
            var stroke = strokes[0];
            var n = stroke.length;
            if (! isShorthandTimeout &&
                len(stroke[n-1][0] - stroke[0][0],
                    stroke[n-1][1] - stroke[0][1]) < shRadius) {

               // CLICK ON STROKE SETS THE TEXT CURSOR.

               if (isHover())
                  sk().setTextCursor(x, y);

               // CLICK NOT ON STROKE TURNS OFF TEXT MODE.

               else
                  toggleTextMode();

               strokes = [];
               return;
            }
            if (! isShorthandMode) {
               var glyphName = interpretStrokes().name;
               if (! isCreatingTextGlyphData)
                  sketchPage.handleDrawnTextChar(glyphName);
            }
            strokes = [];
            return;
         }

         if (isDraggingTimeline) {
            isDraggingTimeline = false;
            console.log("timeline up");
            return;
         }

         // CLICK ON A LINK TO DELETE IT.

         if (this.isFocusOnLink && bgClickCount != 1) {
            if (this.isClick)
               deleteLinkAtCursor();
            return;
         }

         // CLICK AFTER DRAWING A GROUP-DEFINING PATH CREATES A NEW GROUP.

         if (this.isCreatingGroup) {
            this.isCreatingGroup = false;
            this.toggleGroup();
            return;
         }

         // CLICK ON A GROUP TO UNGROUP IT.
         
         if (isHover() && sk().isGroup()) {
            this.toggleGroup();
            return;
         }

         // CLICK ON AN OUT PORT STARTS A LINK.

         if (this.isClick && outPort >= 0 && bgClickCount != 1) {
            sketchAction = "linking";
            return;
         }

         // NON-EXPERT MODE: CLICK ON A SKETCH TO BRING UP ITS PULLDOWN MENU.

         if (! isExpertMode) {
            if (this.isClick && this.isFocusOnSketch) {
               if (! doAction(x, y)) {
                  sk().isPressed = false;
                  pullDownLabels = sketchActionLabels.concat(sk().labels);
                  startPullDown(sketchPage.x, sketchPage.y);
               }
               return;
            }
         }

         // EXPERT MODE:

	 else if (this.isClick && isHover()) {

            // CLICK ON A CODE SKETCH TO BRING UP ITS CODE.

	    if (bgClickCount == 0 && sk().code != null) {
	       toggleCodeWidget();
	       return;
            }

	    // CLICK ON A SKETCH AFTER A BG CLICK TO DO AN ACTION.

            else if (doAction(x, y))
	       return;
	 }

         // SEND UP EVENT TO THE SKETCH AT THE MOUSE.

         if (isk()) {

            if (sk().sketchProgress == 1)
               sk().isPressed = false;
            isSketchDrawingEnabled = true;
            sk().mouseUp(x, y);
         }

         // CLICK OVER BACKGROUND

         if (this.isClick && this.isPossibleClickOverBackground) {

            // EXPERT MODE: START PIE MENU.

            if (isExpertMode || menuType == 1) {
               switch (++bgClickCount) {
               case 1:
                  clickX = x;
                  clickY = y;
                  break;
               case 2:
	          if (len(x - clickX, y - clickY) < 20)
                     startPieMenu(x, y);
                  bgClickCount = 0;
                  break;
               }
            }

            // NOT IN EXPERT MODE: BRING UP THE PAGE PULL DOWN MENU.

            else {
               pullDownLabels = pagePullDownLabels;
               startPullDown(sketchPage.x, sketchPage.y);
            }
         }
      }

      // ROTATE CURRENT SKETCH.

      this.doRotate = function(x, y) {
         if (isk()) {
            sk().rX += 2 * (x - this.mx) /  width();
            sk().rY += 2 * (y - this.my) / -height();
         }
      }

      // SCALE CURRENT SKETCH.

      this.doScale = function(x, y) {
         if (isk())
            sk().scale(pow(16, (y - this.my) / -height()));
      }

      // TRANSLATE CURRENT SKETCH.

      this.doTranslate = function(x, y) {
         if (isk()) {
            sk().translate(x - this.mx, y - this.my);
            if (isSketchInProgress()) {
               cursorX += x - this.mx;
               cursorY += y - this.my;
               sk().sp[0] = [sk().xStart = cursorX, sk().yStart = cursorY, 0];
            }
         }
      }

      // PAN THE SKETCH PAGE

      this.panX = 0;
      this.panY = 0;
      this.zoom = 1;

      this.doPan = function(x, y) {
         this.panX = this.panX + (x - this.mx);
         this.panY = this.panY + (y - this.my);
      }

      // ZOOM THE SKETCH PAGE

      this.doZoom = function(x, y) {
         this.zoom *= 1 - (y - this.my) / height();
      }

      this.doHome = function() {
         this.panX = 0;
         this.panY = 0;
         this.zoom = 1;
      }

      // RESPONSE TO MOUSE MOVE WHILE IN CREATING GROUP PATH MODE.

      this.groupMouseMove = function(x, y) {
         for (var I = 0 ; I < nsk() ; I++)
            if (sk(I).parent == null && sk(I).contains(this.mx, this.my))
               group[I] = true;
         if (isk())
            sk().mouseMove(x, y);
         groupPath.push([x,y]);
      }

      // UNPACK GROUP IF THERE IS ONE.  ELSE CREATE A NEW GROUP.

      this.toggleGroup = function() {

         // FOUND A GROUP: UNPACK IT.

         if (Object.keys(group).length == 0) {
            if (isHover() && sk().isGroup()) {
               for (var i = 0 ; i < sk().children.length ; i++)
                  sk().children[i].parent = null;
               deleteSketchOnly(sk());
            }
            return;
         }

         // OTHERWISE A NEW GROUP IS CREATED.

         addSketch(new SimpleSketch());
         sk().sketchProgress = 1;
         sk().sketchState = 'finished';
         for (var j in group)
            sk().children.push(sk(j));
         sk().computeGroupBounds();
         sk().groupPath = cloneArray(groupPath);
         sk().groupPathLen = computeCurveLength(groupPath);
         sk().labels = "ungroup".split(' ');
         group = {};
         groupPath = [];
      }

      // HANDLE MOUSE MOVE FOR THE SKETCH PAGE.

      this.mouseMove = function(x, y) {

         if (isFakeMouseDown) {
	    this.mouseDrag(x, y);
	    return;
	 }

         if (isKeyboard()) {
	    keyboard.mouseMove(x, y);
	 }

         // IF IN SKETCH-ACTION MODE, MOVING MOUSE DOES THE SKETCH ACTION.

         if (sketchAction != null) {
            switch (sketchAction) {
            case "linking"    : findInSketchAndPort();
                                if (outPort == -1)
                                   sketchAction = null;
                                break;
            case "translating": this.doTranslate(x, y); break;
            case "rotating"   : this.doRotate(x, y); break;
            case "scaling"    : this.doScale(x, y); break;
            }

            this.mx = x;
            this.my = y;
	    bgClickCount = 0;
            return;
         }

         // SPECIAL HANDLING OF MOUSE MOVE IF VARIOUS KEYS ARE PRESSED.

         switch (letterPressed) {
         case 'spc':
            break;
         case 'b':
            if (sk().isGroup()) {

               var p0 = [];
               for (var i = 0 ; i < sk().children.length ; i++)
                  p0[i] = computeCentroid(sk(), sk().children[i], sk().groupPath);

               bendCurve(sk().groupPath, [x,y], sk().groupPathLen * sk().sc);

               for (var i = 0 ; i < sk().children.length ; i++) {
                  var s = sk().children[i];
                  var p1 = computeCentroid(sk(), s, sk().groupPath);
                  var dx = p1[0] - p0[i][0];
                  var dy = p1[1] - p0[i][1];
                  s.translate(dx, dy);
                  s.xlo += dx;
                  s.ylo += dy;
                  s.xhi += dx;
                  s.yhi += dy;
               }

               sk().computeGroupBounds();
            }
            else
               bendCurve(sk().sp0, sk().m2s([x,y]), sk().len, 1);
            break;
         case 'g':
            this.groupMouseMove(x, y);
            break;
         case 'p':
            this.doPan(x, y);
            break;
         case 'r':
            this.doRotate(x, y);
            break;
         case 's':
            this.doScale(x, y);
            break;
         case 't':
            this.doTranslate(x, y);
            break;
         case 'z':
            this.doZoom(x, y);
            break;

         // HANDLING FOR MOUSE MOVE IF NO KEY IS PRESSED.

         default:

            // IF IN GROUP-CREATE MODE, EXTEND THE GROUP PATH.

            if (this.isCreatingGroup)
               this.groupMouseMove(x, y);

            // OTHERWISE IF CURRENT SKETCH IS FINISHED, SEND EVENT TO THE SKETCH.

            else if (isk() && sk().sketchState == 'finished') {
               findOutSketchAndPort();
               sk().mouseMove(x, y);
            }
            break;
         }

         this.mx = x;
         this.my = y;

         // IF MOUSE MOVES OVER THE COLOR PALETTE, SET THE DRAWING COLOR.

         for (var n = 0 ; n < sketchPalette.length ; n++) {
            var dx = x - paletteX(n);
            var dy = y - paletteY(n);
               if (dx * dx + dy * dy < 20 * 20)
                  this.colorIndex = n;
         }
      }

      var altCmdState = 0;

      var keyPressed = -1;

      this.keyDown = function(key) {

         // Ignore multiple presses of the same key

         if (key == keyPressed)
            return;
         keyPressed = key;

         // Catch ALT-CMD-key escape, because it won't trigger
         // any keyUp to reset letterPressed to '\0'.

         if (key == 18) altCmdState |= 1;
         else if (key == 91) altCmdState |= 2;
         else if (altCmdState == 3) {
            altCmdState = 0;
            letterPressed = '\0';
            return;
         }

         var letter = charCodeToString(key);
         letterPressed = letter;

         if (isTextMode) {
            switch (letter) {
            case 'cap':
               isShiftPressed = true;
               break;
            }
            return;
         }

         switch (letter) {
         case 'alt':
            isAltPressed = true;
            return;
         case 'command':
            isCommandPressed = true;
            return;
         case 'control':
            isControlPressed = true;
            return;
         case 'cap':
            isShiftPressed = true;
            return;
         case 'spc':
            isSpacePressed = true;
            return;
         case 'h':
            this.doHome();
            break;
         }
      }

      this.handleDrawnTextChar = function(textChar) {
         if (textChar.length > 0 && textChar.indexOf('(') > 0) {
	    if (textChar == 'kbd()')
	       kbd();
	    return;
         }

         switch (textChar) {
         case 'cap':
            isShiftPressed = ! isShiftPressed;
            break;
         case null:
            break;
         default:
            this.handleTextChar(shift(textChar));
            break;
         }
      }

      this.handleTextChar = function(letter) {
         switch (letter) {
         case 'control': sk().insertText(CONTROL); break;
         case 'alt'    : sk().insertText(ALT    ); break;
         case 'command': sk().insertText(COMMAND); break;
         case L_ARROW:
            sk().moveCursor(-1);
            break;
         case R_ARROW:
            sk().moveCursor(+1);
            break;
         case 'command':
            isCommandPressed = false;
            break;
         case 'control':
            isControlPressed = false;
            break;
         case 'cap':
            isShiftPressed = false;
            break;
         case 'esc':
            setTextMode(false);
            break;
         case '\b':
         case 'del':
            sk().deleteChar();
            break;
         default:
            switch (letter) {
            case 'spc':
               letter = ' ';
               break;
            case 'ret':
               letter = '\n';
               break;
            }
            sk().insertText(letter);
         break;
         }
      }

      this.keyUp = function(key) {

         // Part of logic to account for multiple presses of the same key.

         keyPressed = -1;

         // Convert key to the proper letter encoding.

         letterPressed = '\0';
         var letter = charCodeToString(key);

         // Special handling for when in text mode.

         if (isTextMode) {
            this.handleTextChar(letter);
            return;
         }

         for (var i = 0 ; i < sketchTypes.length ; i++)
            if (letter == sketchTypes[i].substring(0, 1)) {
               addSketchOfType(i);
               sk().setSelection(0);
               return;
            }

         switch (letter) {
         case PAGE_UP:
            break;
         case PAGE_DN:
	    var handle = window[_g.canvas.id];
	    if (! isFakeMouseDown) {
               handle.mouseX = mouseMoveEvent.clientX;
               handle.mouseY = mouseMoveEvent.clientY;
               handle.mousePressedAtX = handle.mouseX;
               handle.mousePressedAtY = handle.mouseY;
               handle.mousePressedAtTime = time;
               handle.mousePressed = true;
	       handle.mouseDown(handle.mouseX, handle.mouseY);
            }
            else {
               if (sketchAction != null) {
                  if (sketchAction == "linking")
                     sketchPage.figureOutLink();
                  sketchAction = null;
               }
	       else {
                  handle.mouseX = mouseMoveEvent.clientX;
                  handle.mouseY = mouseMoveEvent.clientY;
                  handle.mousePressed = false;
	          handle.mouseUp(handle.mouseX, handle.mouseY);
               }
            }
	    isFakeMouseDown = ! isFakeMouseDown;
            break;
         case L_ARROW:
            if (isk())
               sk().offsetSelection(-1);
            break;
         case U_ARROW:
            setPage(pageIndex - 1);
            break;
         case R_ARROW:
            if (isk())
               sk().offsetSelection(1);
            break;
         case D_ARROW:
            setPage(pageIndex + 1);
            break;
         case 'esc':
            if (isShiftPressed)
               clearSketchPage();
            break;
         case 'del':
            if (isk())
               if (isShiftPressed) {
                  deleteSketch(sk());
		  setTextMode(false);
               }
               else
                  sk().removeLastStroke();
            setTextMode(false);
            break;
         case 'spc':
            isSpacePressed = false;
            break;
         case 'alt':
            isAltPressed = false;
            copySketch(sk());
            break;
         case 'command':
            isCommandPressed = false;
            break;
         case 'control':
            isControlPressed = false;
            break;
         case 'cap':
            isShiftPressed = false;
            break;
         case 'a':
            isShowingPresenterView = false;
            if (! isAudiencePopup())
               createAudiencePopup();
            else
               removeAudiencePopup();
            break;
         case 'c':
            if (isk())
               sk().isCard = ! sk().isCard;
            break;
         case 'd':
            isSketchDrawingEnabled = true;
            break;
         case 'e':
	    toggleCodeWidget();
	    break;
         case 'f':
	    isAudioSignal = ! isAudioSignal;
	    setAudioSignal(isAudioSignal ? function(t) { return cos(125 * TAU * t) > 0 ? 1 : -1; }
	                                 : function(t) { return 0; });
	    break;
         case 'g':
            this.toggleGroup();
            break;
         case 'i':
            toggleTextMode();
            break;
         case 'k':
            if (! isTextEditorPopup())
               createTextEditorPopup();
            else
               removeTextEditorPopup();
            break;
         case 'm':
            menuType = (menuType + 1) % 2;
            break;
         case 'n':
            if (isk())
               sk().isNegated = ! sk().isNegated;
            break;
         case 'o':
            isCreatingTextGlyphData = ! isCreatingTextGlyphData;
            break;
         case 'p':
            break;
         case 'q':
            isTest = ! isTest;
            for (var t = 0.0 ; t <= 1.0 ; t += 0.1)
               console.log(t + " " + ef.encode(t));
            break;
         case 'b':
         case 'r':
         case 's':
         case 't':
            break;
         case 'w':
            this.isWhiteboard = ! this.isWhiteboard;
            break;
         case 'x':
            isExpertMode = ! isExpertMode;
            break;
         case 'z':
            break;
         case '-':
	    if (backgroundColor === 'white') {
	       backgroundColor = 'black';
	       defaultPenColor = 'white';
	    }
	    else {
	       backgroundColor = 'white';
	       defaultPenColor = 'black';
	    }
            document.getElementById('background').color = backgroundColor;
	    sketchPalette[0] = defaultPenColor;
	    for (var i = 0 ; i < sketchPage.sketches.length ; i++)
	       if (sketchPage.sketches[i].color == backgroundColor)
	          sketchPage.sketches[i].color = defaultPenColor;
            document.getElementById('code_text').style.backgroundColor = codeTextBgColor();
            document.getElementById('code_text').style.color = codeTextFgColor();
            document.getElementById('code_selector').style.backgroundColor = codeSelectorBgColor();
            document.getElementById('code_selector').style.color = codeSelectorFgColor();
            break;
         }
      }

      this.figureOutLink = function() {

         // END ON A LINK: DELETE THE LINK.

         if (outSketch == null && linkAtCursor != null)
            deleteLinkAtCursor();

         // END ON ANOTHER SKETCH: CREATE A NEW LINK.

         else if (outSketch != null && inSketch != outSketch && inPort >= 0)
            this.createLink();

         // END ON BACKGROUND: CREATE A NEW LINK TO A NEW OUTPUT VALUE SKETCH.

         else if (outSketch != null && isMouseOverBackground) {
            inSketch = this.createTextSketch("   ");
            inPort = 0;
            this.createLink();
         }

         outSketch = inSketch = null;
         outPort = inPort = -1;
      }

      this.animate = function(elapsed) {

         var w = width();
         var h = height();

         if (sketchToDelete != null) {
            deleteSketch(sketchToDelete);
            sketchToDelete = null;
         }

         if (isCodeWidget && ! (isk() && sk().code != null))
            toggleCodeWidget();

	 if (nsk() == 0)
	    outPort = -1;

	 if (this.fadeAway > 0)
	    fadeAwaySketchPage(elapsed);

         noisy = 1;

         for (var I = 0 ; I < nsk() ; I++) {

	    if (sk() == null)
	       break;

            sketchStart();

            var PUSHED_sketchPage_index = sketchPage.index;

            sketchPage.textInputIndex = sketchPage.index;

            sketchPage.index = I;

            sk().updateSelectionWeights(elapsed);

            color(sk().color);

            lineWidth(sketchLineWidth * lerp(sk().styleTransition, 1, .6)
                                      * this.zoom / sk().zoom);

            save();

	    // FADE AWAY THIS SKETCH BEFORE DELETING IT.

	    if (sk().fadeAway > 0) {
	       sk().fadeAway = max(0, sk().fadeAway - elapsed / 0.25);
	       if (sk().fadeAway == 0) {
	          deleteSketch(sk());
		  restore();
	          _g.globalAlpha = 1;
		  bgClickCount = 0;
		  I--;
		  continue;
	       }
	       _g.globalAlpha = sk().fadeAway;
	    }

            if (sk().glyphTrace != null && sk().sketchState != 'finished') {
               sk().trace = [];
            }

	    if (sk().code != null)
	       eval(sk().code);

            if (sk() instanceof Sketch2D) {
               isDrawingSketch2D = true;
               if (sk().x2D == 0) {
                  sk().x2D = This().mouseX;
                  sk().y2D = This().mouseY;
               }
               sk().render(elapsed);
               isDrawingSketch2D = false;
            }
            else {
               m.save();
                  sk().standardView();
                  sk().render(elapsed);
               m.restore();
            }

            if (sk().glyphTrace != null && sk().sketchState != 'finished') {
               morphGlyphToSketch();
               var rate = sk().glyphTransition < 0.5 ? 1 : 1.5;
               sk().glyphTransition = min(1, sk().glyphTransition + rate * elapsed);
               if (sk().glyphTransition == 1) {
                  finishDrawingUnfinishedSketch();
                  sk().glyphTrace = null;
               }
            }

            restore();

            sketchPage.index = PUSHED_sketchPage_index;

            sketchEnd();
         }

         noisy = 0;

         if (isExpertMode) {
            if (letterPressed == 'g' || this.isCreatingGroup)
               drawGroupPath(groupPath);
            if (This().mouseX < 50)
               drawPalette();
            if (isSpacePressed)
               drawPieMenu();
            if (isTextMode && isShorthandMode) {
               color('black');
               lineWidth(1);
               drawOval(This().mousePressedAtX - 4,
                        This().mousePressedAtY - 4, 8, 8);
            }
         }

         if (isTextMode)
	    this.drawTextStrokes();

         if (updateScene != 0) {
            updateScene(elapsed);
            renderer.render(renderer.scene, renderer.camera);
         }

// PLACE TO PUT DIAGNOSTIC MESSAGES FOR DEBUGGING
/*
         var msg = "_g.globalAlpha = " + _g.globalAlpha;
         _g.save();
         _g.font = '20pt Calibri';
         _g.fillStyle = 'black';
         _g.fillText(msg, 70, 30);
         _g.restore();
*/

         if (isKeyboard()) {
            keyboard.x = sk().tX;
            keyboard.y = sk().yhi + keyboard.height();
            keyboard.render();
         }
      }

      this.showShorthand = function() {
         var x0 = This().mousePressedAtX;
         var y0 = This().mousePressedAtY;
         _g.lineWidth = 1;
         var r = shRadius;
         textHeight(12);
         color('rgba(0,32,128,.4)');
         drawOval(x0 - r, y0 - r, 2 * r, 2 * r);

         for (var n = 0 ; n < 8 ; n++) {
            var angle = TAU * n / 8;
            var x = cos(angle), y = -sin(angle);

            color('rgba(0,32,128,.4)');
            line(x0 + r * x    , y0 + r * y,
                 x0 + r * x * 3, y0 + r * y * 3);

            color('rgba(0,32,128,.7)');
            var ch = lookupChar(n, 2);

            var cx = r * x * 3.6;
            var cy = r * y * 3.6;

            color('rgba(0,32,128,.5)');
            text(shift(ch), x0+cx, y0+cy, .5, .5);

            text(shift(lookupChar(n, 0)),
                 x0 + cx*.5 - r*.65 * y,
                 y0 + cy*.5 + r*.65 * x, .5, .5);
            text(shift(lookupChar(n, 4)),
                 x0 + cx*.5 + r*.65 * y,
                 y0 + cy*.5 - r*.65 * x, .5, .5);

            text(shift(lookupChar(n, 1)),
                 x0 + cx - r*.65 * x - r*.60 * y,
                 y0 + cy - r*.65 * y + r*.60 * x, .5, .5);
            text(shift(lookupChar(n, 3)),
                 x0 + cx - r*.65 * x + r*.60 * y,
                 y0 + cy - r*.65 * y - r*.60 * x, .5, .5);
         }
      }

      this.showGlyphs = function() {
            _g.save();
            _g.strokeStyle = 'rgba(0,0,0,.3)';
            _g.font = '10pt Calibri';
            _g.lineWidth = 1;
            var y0 = height() - glyphsH;
            line(0, y0, width(), y0);
            line(0, height()-1, width(), height()-1);

            var t = 5 * floor(sketchPage.mx / (glyphsW/2)) +
                    5 * max(0, min(.99, (sketchPage.my - (y0 + 5)) / (glyphsH - 10)));

            for (var i = 0 ; i < glyphs.length ; i++) {
               _g.fillStyle = t >= i && t < i+1 ? 'black' : 'rgb(0,100,240)';
               var x = (glyphsW/4) + (glyphsW/2) * floor(i / 5);
               var y = height() - glyphsH + (1 + floor(i % 5)) * (glyphsH - 10) / 5;
	       var txt = glyphs[i].name;
	       var j0 = txt.indexOf('(');
	       if (j0 > 0) {
	          var j1 = txt.indexOf(",", j0);
		  if (j1 > 0) {
		     var j2 = txt.indexOf("'", j1);
		     if (j2 > 0) {
		        var j3 = txt.indexOf("'", j2+1);
		        txt = txt.substring(j2+1, j3);
		     }
		  }
		  else
		     txt = txt.substring(0, j0);
	       }
               var tw = textWidth(txt);
               _g.fillText(txt, x - tw/2, y);
               if (i % 10 == 0) {
                  line(x + 60, 0, x + 60, height());
               }
            }

            for (var i = 0 ; i < glyphs.length ; i++) {
               var glyph = glyphs[i];
               var x = (glyphsW*3/16) + glyphsW * floor(i / 10);
               var y =  5 + (i % 10) * (height() - glyphsH) / 10;
               var selected = t >= i && t < i+1;
               _g.strokeStyle = selected ? 'black' : 'rgb(0,100,240)';
               _g.fillStyle = selected ? 'black' : 'rgb(0,100,240)';
               _g.lineWidth = selected ? 2 : 1;

               var nn = glyph.data.length;
               for (var n = 0 ; n < nn ; n++) {
                  var d = glyph.data[n];
                  if (t >= i + n / nn)
                     fillOval(x + d[0][0] * .5 - 3, y + d[0][1] * .5 - 3, 6, 6);
                  _g.beginPath();
                  _g.moveTo(x + d[0][0] * .5, y + d[0][1] * .5);
                  for (var j = 1 ; j < d.length ; j++)
                     if (t > lerp((n + j / d.length) / nn, i, i+1))
                        _g.lineTo(x + d[j][0] * .5, y + d[j][1] * .5);
                  _g.stroke();
               }

               if (t < i+1)
                  break;
            }
            _g.restore();
      }

      this.overlay = function() {
         var w = width(), h = height();

         isShowingTimeline = isDraggingTimeline ||
                             ! isExpertMode
                          && isDef(This().overlay)
                          && ! isPullDown
                          && letterPressed == '\0'
                          && This().mouseX < w - 80
                          && This().mouseY >= h - timelineH;

         // SHOW THE GLYPH DICTIONARY

         if (isShowingGlyphs) {
	    this.showGlyphs();
	    return;
         }

         // SHOW THE TIMELINE

         if (isShowingTimeline) {
            annotateStart();
            color('blue');
            lineWidth(2);
            drawRect(1, h-1 - timelineH, w-2, timelineH);
            annotateEnd();
            return;
         }

         annotateStart();

         // SHOW THE OPTION OF WHETHER TO USE PULLDOWN OR PIE MENU

         color('blue');
         textHeight(12);
         text("Using", w - 40, h - 30, .5, 1);
         text((menuType==0 ? "PullDown" : "Pie Menu"), w - 40, h - 10, .5, 1);

         // DRAW THE COLOR PALETTE

         drawPalette();

         color(overlayColor);

         line(w,0,w,h);
         line(0,h,w,h);

         // LIGHTLY OUTLINE ALL SKETCHES

         _g.save();
         lineWidth(.25);
         for (var i = 0 ; i < nsk() ; i++)
            sk(i).drawBounds();
         _g.restore();

         _g.save();
         _g.font = '30pt Calibri';
         //_g.fillStyle = isTextMode ? overlayScrim : overlayColor;
         _g.fillStyle = overlayScrim;
         _g.fillText("PAGE " + sketchBook.page, 60, 40);
         _g.restore();

         if (this.isWhiteboard)
            text("WHITEBOARD", w - 20, 20, 1, 1);

         // REMIND THE PRESENTER IF CARRYING OUT A SKETCH ACTION.

         if (sketchAction != null) {
            _g.font = 'bold 60pt Calibri';
            color('rgba(0,32,128,.15)');
            _g.fillText(sketchAction, (w - textWidth(sketchAction)) / 2, 80);
         }

         // REMIND THE PRESENTER WHEN INTERFACE IS IN TEXT INSERTION MODE.

         if (isCreatingTextGlyphData) {
            color(overlayColor);
            _g.font = 'bold 20pt Calibri';
            var str = "outputting glyphs";
            _g.fillText(str, w - textWidth(str) - 20, 35);
         }

         if (isTextMode)
	    this.drawTextModeMessage();

         // REMIND THE PRESENTER WHEN INTERFACE IS IN AUTO-SKETCHING MODE.

         if (isk() && sk().sketchProgress < 1) {
            color('rgba(0,32,128,.2)');
            fillRect(0,0,w,h);
            _g.font = 'bold 40pt Calibri';
            var msg = "Finish drawing the sketch";
            color('rgba(0,32,128,.3)');
            _g.fillText(msg, (w - textWidth(msg)) / 2, 80);
         }

         // DRAW EXTRA INFORMATION AROUND THE SELECTED SKETCH.

         if (isk()) {
            color(sk().isGroup() ? 'rgba(255,1,0,.10)' : 'rgba(0,64,255,.06)');
            fillRect(sk().xlo, sk().ylo, sk().xhi-sk().xlo, sk().yhi-sk().ylo);

            if (isHover()) {
               color(sk().isGroup() ? 'rgba(255,1,0,.6)' : 'rgba(0,64,255,.4)');
               sk().drawBounds();
            }

            if (! isHover() && ! isTextMode
                            && sk() instanceof SimpleSketch
                            && sk().text.length == 0
                            && ! sk().isGroup()
                            && sk().sp.length <= 1 )
               deleteSketch(sk());
         }

         if (letterPressed == 'g' || this.isCreatingGroup)
            drawGroupPath(groupPath);

         // SHOW PRESENTER THE AUTO-SKETCHING GUIDE PATTERN.

         if (nsk() > 0 && sk().sp.length > 0
                       && sk().sketchProgress < 1
                       && ! sk().isSimple()) {

            var x0 = sk().sp[0][0], y0 = sk().sp[0][1], r = 14;
            fillPolygon([ [x0-r,y0], [x0,y0-r], [x0+r,y0], [x0,y0+r] ]);

            for (var i = 1 ; i < sk().sp.length ; i++) {
               var p = sk().sp[i-1];
               var q = sk().sp[i];
               lineWidth(2);
               color(q[2] == 0 ? 'rgba(0,64,255,.1)' :
                                 'rgba(0,64,255,.5)' );
               var x = (p[0] + q[0]) / 2;
               var y = (p[1] + q[1]) / 2;
               arrow(p[0], p[1], x, y);
               line(x, y, q[0], q[1]);
            }
         }

         // IF NOT IN TEXT INSERTION MODE, SHOW THE AVAILABLE KEYBOARD SHORTCUTS.

         if (! isTextMode) {
            color(overlayColor);
            lineWidth(1);
            textHeight(12);
            var y0 = paletteY(sketchPalette.length);
            for (var j = 0 ; j < sketchMenu.length ; j++) {
               var y = y0 + j * 20;
               text(sketchMenu[j][0],  8, y, 0, 0);
               text(sketchMenu[j][1], 38, y, 0, 0);
               if (sketchMenu[j][0] == letterPressed)
                  drawRect(3, y - 3, 30, 20);
            }

            if (letterPressed != '\0')
               text(letterPressed + " key pressed", 5, 60, 0, 1);
         }

         // SHOW LINKS BETWEEN SKETCHES.

         if (! this.isPressed)
            linkAtCursor = null;

         for (var I = 0 ; I < nsk() ; I++)
            if (sk(I).parent == null) {
               var a = sk(I);
               for (var i = 0 ; i < a.out.length ; i++)
                  if (isDef(a.out[i]))
                     for (var k = 0 ; k < a.out[i].length ; k++) {
                        var b = a.out[i][k][0];
                        var j = a.out[i][k][1];
                        var s = a.out[i][k][2];
                        drawLink(a, i, a.out[i][k], ! isAudiencePopup());
                        C = a.out[i][k][4];

                        // HIGHLIGHT LINK AT CURSOR -- IN RED IF IT IS BEING DELETED.

                        if (! this.isPressed && isMouseNearCurve(C))
                           linkAtCursor = [a, i, k, a.out[i][k]];

                        if ( linkAtCursor != null && a == linkAtCursor[0]
                                                  && i == linkAtCursor[1]
                                                  && k == linkAtCursor[2] ) {
                           _g.save();
                           color(linkHighlightColor);
                           lineWidth(20);
                           _g.beginPath();
                           _g.moveTo(C[0][0], C[0][1]);
                           for (var n = 1 ; n < C.length ; n++)
                              _g.lineTo(C[n][0], C[n][1]);
                           _g.stroke();
                           _g.restore();
                        }
                     }
            }

         // WHILE A LINK IS BEING DRAWN, SHOW IT:

         if (linkAtCursor == null && isk()
                                  && sketchAction == "linking"
                                  && outSketch != null
                                  && outPort >= 0) {

            if (! isAudiencePopup())
               drawPossibleLink(outSketch, sketchPage.mx, sketchPage.my);

            // HIGHLIGHT POTENTIAL TARGET SKETCH FOR THE LINK.

            for (var i = nsk() - 1 ; i >= 0 ; i--)
               if (isLinkTargetSketch(sk(i))) {
                  if (findNearestInPort(inSketch) >= 0) {
                     _g.save();
                        color(dataColor);
                        lineWidth(1);
                        sk(i).drawBounds();
                     _g.restore();
                  }
                  break;
               }
         }

         // SHOW PORTS IN SKETCHES.

         var saveFont = _g.font;
         _g.font = '12pt Calibri';
         for (var I = 0 ; I < nsk() ; I++)
            if (sk(I).parent == null)
               for (var i = 0 ; i < sk(I).portName.length ; i++)
                  if (isDef(sk(I).portName[i])) {
                     var str = sk(I).portName[i];
                     var A = sk(I).portXY(i);
                     lineWidth(1);
                     sk(I).duringSketch(function(S) {
                        color(portColor);
                        fillRect(A[0] - 5, A[1] - 5, 10, 10);
                     });
                     sk(I).afterSketch(function(S) {
                        var tw = max(portHeight, textWidth(str) + 10);
                        S.portBounds[i] = [A[0] - tw/2, A[1] - portHeight/2,
                                           A[0] + tw/2, A[1] + portHeight/2];
                        var B = S.portBounds[i];
                        if (S == sk() && isHover() || linkAtCursor != null) {
                           color(S==outSketch && i==outPort ? portHighlightColor
                                                            : portBgColor);
                           fillRect(B[0], B[1], B[2]-B[0], B[3]-B[1]);
                           color(portColor);
                           text(str, A[0], A[1], .5, .55);
                        }
                        color(S==inSketch && i==inPort ? 'red' : portColor);
                        drawRect(B[0], B[1], B[2]-B[0], B[3]-B[1]);
                     });
                  }
         _g.font = saveFont;

         // IF IN PULLDOWN MODE, SHOW THE PULLDOWN MENU.

         if (isPullDown) {

            // PH IS THE PULLDOWN CELL HEIGHT.  CONTROLS SIZE OF PULLDOWN.

            var PH = 30;

            var isPageMenu = pullDownLabels == pagePullDownLabels;

            var n = pullDownLabels.length;
            var x = pullDownX, y = pullDownY, w = PH * 5, h = PH * n;
            var mx = This().mouseX, my = This().mouseY;

            if (mx >= x && mx < x + w) {
               var t = (my - y) / PH;
               pullDownSelection = t < 0 || t >= pullDownLabels.length ? -1 : floor(t);
            }
            else if (!(mx >= x + w && isPageMenu &&
                pullDownSelection >= pageActionLabels.length &&
                sketchTypeLabels[pullDownSelection - pageActionLabels.length].length > 0))
               pullDownSelection = -1;

            function drawMenu(x, y, labels, selection) {
               var w = PH * 5;
               var h = PH * labels.length;

               // DRAW A SHADOW BEHIND THE MENU.

               color('rgba(0,0,0,.02)');
               for (var i = 0 ; i < 10 ; i += 2)
                  fillRect(x + PH/2 + i, y + PH/2 + i, w - 2 * i, h - 2 * i);

               // FILL THE MENU WITH ITS BACKGROUND COLOR.

               color('rgb(247,251,255)');
               fillRect(x, y, w, h);

               // HIGHLIGHT THE CURRENT SELECTION.

               if (selection >= 0) {
                  color('rgba(0,128,255,.2)');
                  fillRect(x, y + PH * selection, w, PH);
               }

               // DRAW ALL THE TEXT LABELS.

               color('black');
               textHeight(PH * 3 / 5);
               for (var row = 0 ; row < labels.length ; row++)
                  text(labels[row], x + PH/7, y + PH/2 + PH * row, 0, .55);

               // DARKEN THE RIGHT AND BOTTOM EDGES.

               lineWidth(1);

               color('rgba(0,0,0,.08)');
               line(x, y, x + w, y);
               line(x, y, x, y + h);

               color('rgba(0,0,0,.24)');
               line(x + w, y, x + w, y + h);
               line(x, y + h, x + w, y + h);
            }

            drawMenu(x, y, pullDownLabels, pullDownSelection);

            // DRAW SEPARATOR BETWEEN FIXED CHOICES AND VARIABLE CHOICES.

            var actionLabels =
               pullDownLabels == pagePullDownLabels ? pageActionLabels
                                                    : sketchActionLabels;
            color('rgba(0,0,0,.28)');
            fillRect(x, y + actionLabels.length * PH, w - 1, 1);

            // IF SELECTED SKETCH TYPE CONTAINS OPTIONS, SHOW THE SECONDARY MENU.

            if (pullDownLabels == pagePullDownLabels) {
               for (var n = 0 ; n < sketchTypeLabels.length ; n++)
                  if (sketchTypeLabels[n].length > 0) {
                     var nn = pageActionLabels.length + n;

                     // DRAW A SMALL RIGHT ARROW TO SHOW THIS SKETCH TYPE HAS OPTIONS.

                     color('rgb(128,128,128)');
                     var ax = x + w - PH*7/10;
                     var ay = y + PH * nn + PH/4;
                     fillPolygon([ [ax, ay], [ax + PH/2-1, ay + PH/4], [ax, ay + PH/2] ]);

                     // FOR SELECTED SKETCH TYPE, SHOW WHAT THE OPTIONS ARE.

                     if (nn == pullDownSelection) {
                        var tx = x+w, ty = y + PH*nn;
                        var nRows = sketchTypeLabels[n].length;
                        sketchLabelSelection = -1;
                        if ( mx >= tx && mx < tx + w &&
                             my >= ty && my < ty + PH * nRows )
                           sketchLabelSelection = floor((my - ty) / PH);
                        drawMenu(tx, ty, sketchTypeLabels[n], sketchLabelSelection);
                     }
                  }
            }
         }

         if (isAudiencePopup() && ! isShowingGlyphs) {
            color('rgba(0,32,128,.2)');
            var msg = "AUDIENCE POPUP IS SHOWING";
            _g.font = 'bold 40pt Calibri';
            _g.fillText(msg, (w - textWidth(msg)) / 2, h - 50);
         }

         if (isSpacePressed)
            drawPieMenu();
         else if (isPieMenu && pieMenuCursorWeight == 0)
            drawPieMenu(pieMenuXDown, pieMenuYDown);

         if (pieMenuStroke.length > 0) {
            lineWidth(10);
            color('rgba(0,0,255,0.1)');
            curve(pieMenuStroke);
         }

         annotateEnd();
      }

      this.computePortBounds = function() {
         var saveFont = _g.font;
         _g.font = '12pt Calibri';
         for (var I = 0 ; I < nsk() ; I++) {
            var sketch = sk(I);
            if (sketch.parent == null)
               for (var i = 0 ; i < sketch.portName.length ; i++)
                  if (sketch.sketchProgress == 1 && isDef(sketch.portName[i])) {
                     var str = sketch.portName[i];
                     var A = sketch.portXY(i);
                     var tw = max(portHeight, textWidth(str) + 10);
                     var px = A[0] - tw/2;
                     var py = A[1] - portHeight/2;
                     var pw = tw;
                     var ph = portHeight;
                     sketch.portBounds[i] = [px, py, px + pw, py + ph];
                  }
         }
         _g.font = saveFont;
      }

      this.advanceCurrentSketch = function() {
         // AFTER SKETCHING: TRANSITION SKETCH STYLE AND RESTORE CURSOR POSITION.

         if (isk() && sk().sketchState == 'in progress')
            if (sk().sketchProgress < 1) {
               var n = sk().sp.length;
               sk().cursorX = sk().sp[n-1][0];
               sk().cursorY = sk().sp[n-1][1];
            }
            else {
               var t = sCurve(sk().cursorTransition);
               cursorX = lerp(t, sk().cursorX, This().mouseX);
               cursorY = lerp(t, sk().cursorY, This().mouseY);

               sk().styleTransition  = min(1, sk().styleTransition + 1.4 * This().elapsed);
               sk().cursorTransition = min(1, sk().cursorTransition + This().elapsed);

               if (sk().cursorTransition == 1)
                  sk().sketchState = 'finished';
            }
      }

      this.drawTextModeMessage = function() {
         var w = width(), h = height();
         color('rgba(0,32,128,.07)');
         fillRect(0,0,w,h);
         _g.font = 'bold 60pt Calibri';
         var msg = isShiftPressed ? "TAP TO EXIT TEXT MODE"
                                  : "tap to exit text mode" ;
         color('rgba(0,32,128,.2)');
         _g.fillText(msg, (w - textWidth(msg)) / 2, 80);

         if (isCreatingTextGlyphData) {
            var str = "outputting glyphs";
            _g.fillText(str, (w - textWidth(str)) / 2, 200);
         }
      }

      this.drawTextStrokes = function() {
         if (isCreatingTextGlyphData || This().mousePressed) {
            var ts = This().mousePressed ? strokes[0]
                                         : textGlyph == null ? []
                                         : textGlyph.data[0];

            var isShowingShorthand = isShorthandMode && isShorthandTimeout;

            if (isDef(ts) && ts.length > 0) {
               _g.lineWidth = isShowingShorthand ? 2 : 4;
               _g.beginPath();
               //_g.strokeStyle = 'red';
               var i0 = isShowingShorthand ? iOut : 0;
               if (ts.length > i0) {
                  _g.moveTo(ts[i0][0], ts[i0][1]);
                  for (var i = i0 + 1 ; i < ts.length ; i++)
                     _g.lineTo(ts[i][0], ts[i][1]);
                  _g.stroke();
               }
            }

         if (isShowingShorthand)
            this.showShorthand();
         }
      }
   }

   var sketchPage = sketchBook.setPage(0);

   function Sketch() {
      this.transformX2D = function(x, y) {
         var angle = 2 * this.rX;
         return this.x2D + this.scale() * (cos(angle)*x + sin(angle)*y);
      }
      this.transformY2D = function(x, y) {
         var angle = 2 * this.rX;
         return this.y2D + this.scale() * (cos(angle)*y - sin(angle)*x);
      }
      this.untransformX2D = function(x, y) {
         return (x - this.x2D) / this.scale();
      }
      this.untransformY2D = function(x, y) {
         return (y - this.y2D) / this.scale();
      }
      this.duringSketch = function(drawFunction) {
         if (this.sketchProgress < 1) {
            _g.save();
            _g.globalAlpha = 1 - this.styleTransition;
            drawFunction(this);
            _g.restore();
         }
      }
      this.afterSketch = function(drawFunction) {
         var isg = this.glyphTrace != null && this.glyphTransition >= 0.5;
         if (isg || this.sketchProgress == 1) {
            _g.save();
            _g.globalAlpha = isg ? 2 * this.glyphTransition - 1
                                 : this.styleTransition;
            if (isg)
               _g.lineWidth = sketchLineWidth * .6;
            drawFunction(this);
            _g.restore();
         }
      }
      this.clearPorts = function() {
         this.nPorts = 0;
         this.portName = [];
         this.portLocation = [];
         this.portBounds = [];
         this.inValue = [];
         this.outValue = [];
      }
      this.addPort = function(name, x, y) {
         this.portName[this.nPorts] = name;
         this.portLocation[this.nPorts] = [x, y];
         this.nPorts++;
      }
      this.setPortLocation = function(name, x, y) {
         var index = getIndex(this.portName, name);
	 if (index >= 0 && index < this.portLocation.length) {
            this.portLocation[index][0] = x;
            this.portLocation[index][1] = y;
         }
      }
      this.children = [];
      this.cleanup = null;
      this.clone = function() {
         var dst = Object.create(this);
         for (var prop in this) {
            if (this[prop] instanceof Array)
               dst[prop] = cloneArray(this[prop]);
            else if (this[prop] instanceof Clonable)
               dst[prop] = Object.create(this[prop]);
            else
               dst[prop] = this[prop];
         }
         return dst;
      }
      this.code = null;
      this.color = sketchColor();
      this.colorIndex = [];
      this.computeGroupBounds = function() {
         this.xlo = this.ylo =  10000;
         this.xhi = this.yhi = -10000;
         for (var j = 0 ; j < this.children.length ; j++) {
            var child = this.children[j];
            child.parent = this;
            this.xlo = min(this.xlo, child.xlo);
            this.ylo = min(this.ylo, child.ylo);
            this.xhi = max(this.xhi, child.xhi);
            this.yhi = max(this.yhi, child.yhi);
         }
      }
      this.computeStatistics = null;
      this.contains = function(x, y) {
         return this.xlo <= x && this.ylo <= y && this.xhi > x && this.yhi > y;
      }
      this.cx = function() {
         return (this.xlo + this.xhi) / 2;
      }
      this.cy = function() {
         return (this.ylo + this.yhi) / 2;
      }
      this.dSum = 0;
      this.deleteChar = function() {
         if (this.textCursor > 0) {
            this.setText(this.text.substring(0, this.textCursor-1) +
                         this.text.substring(this.textCursor, this.text.length));
            this.textCursor--;
         }
      }
      this.drawBounds = function() {
         if (this.parent == null)
            drawRect(this.xlo, this.ylo, this.xhi - this.xlo, this.yhi - this.ylo);
      }
      this.drawCursor = function(x, y, dy, context) {
         y += 0.35 * dy;

         context.save();

         context.lineWidth = .07 * dy;
         context.strokeStyle = defaultPenColor;
         context.beginPath();

         var x0 = x - dy * 4/16;
         var x1 = x + dy * 4/16;

         var y0 = y - dy * 19/16;
         var y1 = y - dy * 18/16;
         var y2 = y + dy *  3/16;
         var y3 = y + dy *  4/16;

         context.moveTo(x, y1);
         context.lineTo(x, y2);

         context.moveTo(x0, y0);
         context.lineTo(x , y1);
         context.lineTo(x1, y0);

         context.moveTo(x0, y3);
         context.lineTo(x , y2);
         context.lineTo(x1, y3);

         context.stroke();

         context.restore();
      }
      this.drawFirstLine = false;
      this.drawText = function(context) {
         var fontSize = floor(24 * this.scale());

         if (this instanceof SimpleSketch && this.isNullText()) {
            if (isDef(this.inValue[0])) {

               context.save();
                  context.strokeStyle = backgroundColor;
                  context.fillStyle = dataColor;
                  context.font = fontSize + 'pt Comic Sans MS';
                  var str = roundedString(this.inValue[0]);

                  // JUSTIFY THE NUMBER CONSISTENTLY (WHETHER INT OR FLOAT)

                  var i = str.indexOf('.');
                  if (i >= 0)
                     this.isFloat = true;
                  if (this.isFloat && i < 0) {
                     str += ".00";
                     i = str.indexOf('.');
                  }
                  var dx = this.isFloat ? textWidth(str.substring(0, i))
                                        : textWidth(str) / 2;

                  context.fillText(str, this.cx() - dx, this.cy() + .5 * fontSize);
               context.restore();
            }
            return;
         }

         context.save();
         context.strokeStyle = this.isNegated ? this.color : backgroundColor;
         context.fillStyle = this.isNegated ? backgroundColor : this.color;

         var fontHeight = this.isParsed() ? floor(0.7 * fontSize) : fontSize;

         context.font = fontHeight + 'pt ' + (this.isParsed() ? 'Consolas'
                                                              : 'Comic Sans MS');

         var isCursor = isTextMode && context == _g
                                   && this == sk(sketchPage.textInputIndex);
         if (! isCursor && this.text.length == 0)
            return;

         if (this.text.length == 0) {
            this.drawCursor(this.tx(), this.ty(), fontHeight, context);
            return;
         }

         var x1 = this instanceof Sketch2D ? this.x2D : lerp(this.scale(), this.tx(), this.textX);
         var y1 = this instanceof Sketch2D ? this.y2D : lerp(this.scale(), this.ty(), this.textY);

         var j = 0;
         for (var n = 0 ; n < this.textStrs.length ; n++) {
            var str = this.textStrs[n];
            var tw = textWidth(str, context);
            var x = x1;
            var y = y1 + 1.3 * fontHeight * (n - 0.5 * (this.textStrs.length-1));
            var tx = x - .5 * tw;
	    if (this.fadeAway > 0)
	       context.globalAlpha = this.fadeAway;
            context.fillText(str, tx, y + .35 * fontHeight);

            // IF A TEXT CURSOR X,Y HAS BEEN SPECIFIED, RESET THE TEXT CURSOR.

            if (this.textCursorXY != null) {
               var _x = this.textCursorXY[0];
               var _y = this.textCursorXY[1];
               if ( _x >= tx      - sketchPadding && _y >= y - 0.65 * fontHeight &&
                    _x <  tx + tw + sketchPadding && _y <  y + 0.35 * fontHeight ) {
                  var i = 0;
                  for ( ; i < str.length ; i++) {
                     var tw0 = textWidth(str.substring(0, i  ));
                     var tw1 = textWidth(str.substring(0, i+1));
                     if (_x < tx + (tw0 + tw1) / 2)
                        break;
                  }
                  this.textCursor = j + i;                
                  this.textCursorXY = null;
               }
            }

            if (isCursor) {
               if (this.textCursor >= j && this.textCursor <= j + str.length) {
                  var cx = tx + textWidth(str.substring(0,this.textCursor - j));
                  this.drawCursor(cx, y, fontHeight, context);
               }
               j += str.length;
            }
            j++;
         }
         context.restore();
      }
      this.setTextCursor = function(x, y) { this.textCursorXY = [x, y]; }
      this.fadeAway = 0;
      this.getInIndex = function(s) { return getIndex(this.in, s); }
      this.getInFloat = function(name) {
         return parseFloat(this.getInValue(name));
      }
      this.getInValue = function(name) {
         var j = getIndex(this.portName, name);
         if (j < 0) return 0;
         var value = this.inValue[j];
         return value == null ? "0" : value;
      }
      this.glyphTrace = null;
      this.trace = [];
      this.glyphTransition = 0;
      this.groupPath = [];
      this.groupPathLen = 1;
      this.id;
      this.in = []; // array of Sketch
      this.inValue = []; // array of values
      this.insertText = function(str) {
         this.setText(this.text.substring(0, this.textCursor) +
                      str +
                      this.text.substring(this.textCursor, this.text.length));
         this.textCursor += str.length;
      }
      this.invertStandardView = function() {
         invertStandardView(.5 + this.tx() / width(),
                            .5 - this.ty() / height(),
                            this.is3D ? PI * this.rY : 0,
                            this.is3D ? PI * this.rX : 0,
                            this.is3D ? 0 : -TAU * this.rX,
                            .25 * this.scale());
      }
      this.is3D = false;
      this.isCard = false;
      this.isGroup = function() { return this.children.length > 0; }
      this.isInValue = function(name) {
         var j = getIndex(this.portName, name);
         return j >= 0 ? isDef(this.inValue[j]) : false;
      }
      this.isMouseOver = false;
      this.isNegated = false;
      this.isNullText = function() { return this.text.replace(/ /g, '').length == 0; }
      this.isParsed = function() { return false; }
      this.isSimple = function() { return this instanceof SimpleSketch; }
      this.keyDown = function(key) {}
      this.keyUp = function(key) {}
      this.labels = [];
      this.m2s = function(p) { return [ this.m2x(p[0]), this.m2y(p[1]) ]; }
      this.m2x = function(x) { return (x - this.tx()) / this.scale(); }
      this.m2y = function(y) { return (y - this.ty()) / this.scale(); }
      this.mouseDown = function(x, y) {}
      this.mouseDrag = function(x, y) {}
      this.mouseMove = function(x, y) {}
      this.mouseUp = function(x, y) {}
      this.moveCursor = function(incr) {
         this.textCursor = max(0, min(this.text.length, this.textCursor + incr));
      }
      this.nPorts = 0;
      this.offsetSelection = function(d) { this.selection += d; }
      this.out = []; // array of array of Sketch
      this.outValue = []; // array of values
      this.parent = null;
      this.parse = function() { }
      this.portName = [];
      this.portLocation = [];
      this.portBounds = [];
      this.portXY = function(i) {
         if (isDef(this.portLocation[i])) {
            if (this instanceof Sketch2D) {
               var p = this.portLocation[i];
               return [ this.transformX2D(p[0],p[1]), this.transformY2D(p[0],p[1]) ];
            }
            else {
               m.save();
               this.standardView();
               var xy = m.transform(this.portLocation[i]);
               m.restore();
               return xy;
            }
         }
         return [this.cx(),this.cy()];
      }
      this.rX = 0;
      this.rY = 0;
      this.lastStrokeSize = function() {
         if (this.sp.length > 1) {
            var i = this.sp.length;
            var x0 = 10000, y0 = 10000, x1 = -x0, y1 = -y0;
            while (--i > 0 && this.sp[i][2] == 1) {
               x0 = min(x0, this.sp[i][0]);
               y0 = min(y0, this.sp[i][1]);
               x1 = max(x1, this.sp[i][0]);
               y1 = max(y1, this.sp[i][1]);
            }
            return max(x1 - x0, y1 - y0);
         }
         return 0;
      }
      this.removeLastStroke = function() {
         if (this.sp.length > 1) {
            var i = this.sp.length;
            while (--i > 0 && this.sp[i][2] == 1) ;
            this.sp0.splice(i, this.sp.length-i);
            this.sp.splice(i, this.sp.length-i);
         }
      }
      this.render = function() {}
      this.sc = 1;
      this.scale = function(value) {
         if (value === undefined) {
            var s = this.sc;
            if (this.parent != null)
               s *= this.parent.scale();
            return s * sketchPage.zoom;
         }
         this.sc *= value;
         if (this.isGroup()) {
            function sx(x) { return cx + (x - cx) * value; }
            function sy(y) { return cy + (y - cy) * value; }
            var cx = this.cx();
            var cy = this.cy();
            for (var i = 0 ; i < this.groupPath.length ; i++) {
               this.groupPath[i][0] = sx(this.groupPath[i][0]);
               this.groupPath[i][1] = sy(this.groupPath[i][1]);
            }
            this.xlo = zpx(sx(izpx(this.xlo)));
            this.ylo = zpy(sy(izpy(this.ylo)));
            this.xhi = zpx(sx(izpx(this.xhi)));
            this.yhi = zpy(sy(izpy(this.yhi)));

            for (var i = 0 ; i < this.children.length ; i++) {
               this.children[i].textX = sx(this.children[i].textX);
               this.children[i].textY = sy(this.children[i].textY);
               if (this.children[i] instanceof Sketch2D) {
                  this.children[i].x2D = sx(this.children[i].x2D);
                  this.children[i].y2D = sy(this.children[i].y2D);
               }
            }
         }
      }
      this.selection = 0;
      this.setOutValue = function(name, value) {
         var j = getIndex(this.portName, name);
         if (j >= 0)
            this.outValue[j] = value;
      }
      this.setSelection = function(s) {
         if (typeof(s) == 'string')
            s = getIndex(this.labels, s);
         this.selection = s;
         this.updateSelectionWeights(0);
      }
      this.selectionWeight = function(i) {
         return sCurve(this.selectionWeights[i]);
      }
      this.size = 400;
      this.suppressLineTo = false;
      this.updateSelectionWeights = function(delta) {
         if (this.labels.length == 0)
            return;
         if (this.selectionWeights === undefined) {
            this.selectionWeights = [];
            for (var i = 0 ; i < this.labels.length ; i++)
               this.selectionWeights.push(this.selection == i ? 1 : 0);
         }
         for (var i = 0 ; i < this.labels.length ; i++)
            if (i == this.selection)
               this.selectionWeights[i] = min(1, this.selectionWeights[i] + 2 * delta);
            else
               this.selectionWeights[i] = max(0, this.selectionWeights[i] - delta);
      }
      this.setText = function(text) {

         if (! this.isSimple() && ! (this instanceof Sketch2D))
            return;

         if (this instanceof Number)
            this.value = text;

         this.text = text;
         if (this.textX == 0) {
            this.textX = (this.xlo + this.xhi) / 2;
            this.textY = (this.ylo + this.yhi) / 2;

            var xx = 0;
            for (var i = 1 ; i < this.sp.length ; i++)
               xx += this.sp[i][0];
            this.textX = (this.textX + xx / (this.sp.length-1)) / 2;
         }

         _g.save();

         this.textStrs = this.text.split("\n");
         this.drewFirstLine = true;
         this.textHeight = this.textStrs.length * 1.3 * 24;

         this.textWidth = 0;
         _g.font = '24pt Comic Sans MS';
         for (var n = 0 ; n < this.textStrs.length ; n++)
            this.textWidth = max(this.textWidth, textWidth(this.textStrs[n]));

         _g.restore();
      }
      this.sketchLength = 1;
      this.cursorTransition = 0;
      this.sketchProgress = 0;
      this.sketchState = 'finished';
      this.styleTransition = 0;
      this.sp = [];
      this.standardView = function(p) {
         standardView(.5 + this.tx() / width(),
                      .5 - this.ty() / height(),
                      this.is3D ? PI * this.rY : 0,
                      this.is3D ? PI * this.rX : 0,
                      this.is3D ? 0 : -TAU * this.rX,
                      .25 * this.scale());
      }
      this.tX = 0;
      this.tY = 0;
      this.text = "";
      this.textCursor = 0;
      this.textHeight = -1;
      this.textStrs = [];
      this.textX = 0;
      this.textY = 0;
      this.translate = function(dx, dy) {
         if (this.isGroup()) {
            this.xlo += dx;
            this.ylo += dy;
            this.xhi += dx;
            this.yhi += dy;
            for (var i = 0 ; i < this.groupPath.length ; i++) {
               this.groupPath[i][0] += dx;
               this.groupPath[i][1] += dy;
            }
            moveChildren(this.children, dx, dy);
         }
         else if (this instanceof Sketch2D) {
            this.x2D += dx;
            this.y2D += dy;
         }
         else {
            this.tX += dx;
            this.tY += dy;
            this.textX += dx;
            this.textY += dy;
         }
      }
      this.tx = function() {
         var x = this.tX;
         if (this.parent != null) {
            var cx = this.parent.cx();
            if (! this.isSimple())
               cx -= width() / 2;
            x -= cx;
            x = this.parent.tx() + this.parent.scale() * x;
            x += cx;
         }
         return zpx(x);
      }
      this.ty = function() {
         var y = this.tY;
         if (this.parent != null) {
            var cy = this.parent.cy();
            if (! this.isSimple())
               cy -= height() / 2;
            y -= cy;
            y = this.parent.ty() + this.parent.scale() * y;
            y += cy;
         }
         return zpy(y);
      }
      this.value = null;
      this.x = 0;
      this.xStart = 0;
      this.xf = [0,0,1,0,1];
      this.y = 0;
      this.yStart = 0;
      this.zoom = 1;
   }

   function Sketch2D() {
      this.width = 400;
      this.height = 400;
      this.x2D = 0;
      this.y2D = 0;
      this.mouseX = -1000;
      this.mouseY = -1000;
      this.mousePressed = false;

      this.mouseDown = function(x, y) {
         if (this.sketchProgress == 1) {
            this.mousePressed = true;
            this.mouseX = this.untransformX2D(x, y);
            this.mouseY = this.untransformY2D(x, y);
            this.x = this.mouseX;
            this.y = this.mouseY;
         }
      }

      this.mouseDrag = function(x, y) {
         if (this.sketchProgress == 1) {
            this.mouseX = this.untransformX2D(x, y);
            this.mouseY = this.untransformY2D(x, y);
            this.x = this.mouseX;
            this.y = this.mouseY;
         }
      }

      this.mouseUp = function(x, y) {
         if (this.sketchProgress == 1) {
            this.mousePressed = false;
         }
      }
   }
   Sketch2D.prototype = new Sketch;

   function SimpleSketch() {
      this.sp0 = [[0,0]];
      this.sp = [[0,0,0]];
      this.drewFirstLine = false;
      this.parsed = null;
      this.parsedSrc = null;
      this.parsedTransition = 0;

      this.isParsed = function() {
         return this.parsed != null;
      }

      this.mouseDown = function(x, y) {
         if (this.isGroup())
            return;

         var p = this.m2s([x,y]);
         this.sp0.push(p);
         this.sp.push([p[0],p[1],0]);
      }
      this.mouseDrag = function(x, y) {
         if (this.isGroup())
            return;

         var p = this.m2s([x,y]);
         this.sp0.push(p);
         this.sp.push([p[0],p[1],1]);
      }

      this.mouseUp = function(x, y) {
         if (this.isGroup())
            return;

         if (isTextMode)
            return;

         // COMPUTE BOUNDING BOX OF DRAWING.

         var xlo =  100000, ylo =  100000;
         var xhi = -100000, yhi = -100000;
         for (var i = 1 ; i < this.sp0.length ; i++) {
            xlo = min(xlo, this.sp0[i][0]);
            ylo = min(ylo, this.sp0[i][1]);
            xhi = max(xhi, this.sp0[i][0]);
            yhi = max(yhi, this.sp0[i][1]);
         }
         xlo = zpx(xlo);
         ylo = zpy(ylo);
         xhi = zpx(xhi);
         yhi = zpy(yhi);

         // PARSE FOR VARIOUS KINDS OF SWIPE ACTION UPON ANOTHER SKETCH.

         if (isk() && sk() instanceof SimpleSketch && ! sk().drewFirstLine) {
            var action = null, I = 0;
            for ( ; I < nsk() ; I++)
               if (sk(I) != sk() && sk(I).parent == null) {
                  var n = sk().sp0.length;

                  // FOR X AND Y, TEST WHETHER THIS STROKE EITHER:
                  // SPANS, MEETS OR NESTS IN THE SKETCH.

                  var xSpans = xlo < sk(I).xlo && xhi > sk(I).xhi;
                  var xMeets = xlo < sk(I).xhi && xhi > sk(I).xlo;
                  var xNests = xlo > sk(I).xlo && xhi < sk(I).xhi;

                  var ySpans = ylo < sk(I).ylo && yhi > sk(I).yhi;
                  var yMeets = ylo < sk(I).yhi && yhi > sk(I).ylo;
                  var yNests = ylo > sk(I).ylo && yhi < sk(I).yhi;

                  // FOR X AND Y, TEST WHETHER FIRST AND LAST POINT OF STROKE:
                  // IS TO THE LEFT, MIDDLE OR RIGHT OF THE SKETCH.

                  var x0 = zpx(sk().sp0[  1][0]), x0L = x0 < sk(I).xlo,
                                                  x0H = x0 > sk(I).xhi,
                                                  x0M = ! x0L && ! x0H;
                  var y0 = zpy(sk().sp0[  1][1]), y0L = y0 < sk(I).ylo,
                                                  y0H = y0 > sk(I).yhi,
                                                  y0M = ! y0L && ! y0H;
                  var xn = zpx(sk().sp0[n-1][0]), xnL = xn < sk(I).xlo,
                                                  xnH = xn > sk(I).xhi,
                                                  xnM = ! xnL && ! xnH;
                  var yn = zpy(sk().sp0[n-1][1]), ynL = yn < sk(I).ylo,
                                                  ynH = yn > sk(I).yhi,
                                                  ynM = ! ynL && ! ynH;

                  // CHECK FOR GOING IN THEN BACK OUT OF SKETCH FROM TOP,B,L OR R:

                  if (xNests && yMeets && y0L && ynL) { action = "translating"; break; }
                  if (xNests && yMeets && y0H && ynH) { action = "rotating"; break; }
                  if (xMeets && yNests && x0L && xnL) { action = "scaling"; break; }
                  if (x0L && y0M && xnM && ynL      ) { action = "parsing"; break; }
                  if (xMeets && yNests && x0H && xnH) { action = "deleting"; break; }
                  if (xMeets && yMeets              ) { action = "joining"; break; }
               }

            // JOIN: APPEND STROKE TO sk(I), INVERT sk(I) XFORM FOR EACH PT OF STROKE.

            if (action == "joining" && isk()) {
               sk(I).makeXform();
               for (var i = 1 ; i < sk().sp0.length ; i++) {
                  var xy = sk().sp0[i];
                  xy = [ zpx(xy[0]), zpy(xy[1]) ];
                  xy = sk(I).xformInverse(xy);
                  sk(I).sp0.push(xy);
                  sk(I).sp.push([xy[0], xy[1], i == 1 ? 0 : 1]);
               }
            }

            // IF THIS WAS AN ACTION STROKE, DELETE IT.

            if (action != null)
               deleteSketch(sk());

            // DO THE ACTION, IF ANY.

            switch (action) {
            case "translating":
            case "rotating":
            case "scaling":
               selectSketch(I);
               sketchAction = action;
               break;
            case "parsing":
               sk(I).parse();
               break;
            case "deleting":
               deleteSketch(sk(I));
               break;
            }
         }

         // CLICK

         if (max(xhi - xlo, yhi - ylo) < 10) {

            // SKETCH WAS JUST BYPRODUCT OF A CLICK.  DELETE IT.

            if (this.text.length == 0) {
               deleteSketch(sk());
               if (linkAtCursor != null)
                  deleteLinkAtCursor();
            }

            // CLICK WAS OVER USER TYPED TEXT.

            if (this.text.length > 0 && ! isDef(this.inValue[0])) {

               // REMOVE ANY REMNANTS OF A STROKE LEFT BY CLICK.

               if (this.sp0.length < 10) {
                  this.sp0 = [[0,0]];
                  this.sp = [[0,0,0]];
               }

               // POSITION CURSOR AND ENTER TEXT MODE.
               // (NOT YET FULLY IMPLEMENTED).

               setTextMode(true);
            }

            return;
         }

         // CLICK TO REINTERPRET SKETCH AS A TEXT CHARACTER.

         if (this.isClick) {
            this.removeLastStroke();

            strokes = this.getStrokes();

            var glyph = interpretStrokes();
            if (glyph != null) {

               // IF GLYPH IS A DIGIT, CREATE A NUMBER OBJECT.

               if (isNumber(parseInt(glyph.name))) {
                  deleteSketch(this);
                  var s = new Number();
                  addSketch(s);
                  s.init(glyph.name, this.tX, this.tY);
                  s.textCursor = s.text.length;
                  setTextMode(true);
               }

               // IF A '(' IS FOUND, CALL A FUNCTION.

               else if (glyph.name.indexOf('(') > 0) {
                  glyphSketch = sk();
                  eval(glyph.name);
                  deleteSketch(glyphSketch);
                  return;
               }

               // DEFAULT: CREATE A TEXT OBJECT.

               else {
                  deleteSketch(this);
                  sketchPage.createTextSketch(glyph.name);
                  setTextMode(true);
               }

            }
            return;
         }

         if (! this.drewFirstLine) {
            var x0 = (xlo + xhi) / 2;
            var y0 = (ylo + yhi) / 2;
            this.tX += x0;
            this.tY += y0;
            for (var i = 1 ; i < this.sp0.length ; i++) {
               this.sp0[i][0] -= x0;
               this.sp0[i][1] -= y0;
            }
            this.drewFirstLine = true;
         }

         this.len = computeCurveLength(this.sp0, 1);
      }

      this.getStrokes = function() {
         strokes = [];
         var n = -1;
         for (var i = 1 ; i < this.sp.length ; i++) {
            if (this.sp[i][2] == 0) {
               strokes.push([]);
               n++;
            }
            if (n >= 0)
               strokes[n].push([ this.sp[i][0], this.sp[i][1] ]);
         }
         return strokes;
      }

      this.parse = function() {
         if (this.isGroup()) {
            console.log("NEED TO IMPLEMENT PARSING A GROUP");
            return;
         }

         strokes = this.getStrokes();
         this.parsedSrc = [];
         for (var n = 0 ; n < strokes.length ; n++)
            this.parsedSrc = this.parsedSrc.concat(segmentStroke(strokes[n]));
         this.parsed = parseStrokes(this.parsedSrc, this);

         var xs     = this.parsed[0][0];
         var ys     = this.parsed[0][1];
         var points = this.parsed[1];
         var lines  = this.parsed[2];

         // MAKE SURE CENTER OF SCALING IS AT CENTER OF DRAWING.
/*
         // This is on-hold until I fix the bounding box bug it causes. -KP

         var B = strokesComputeBounds(this.parsedSrc);
         this.tX = (B[0] + B[2]) / 2;
         this.tY = (B[1] + B[3]) / 2;
*/
         // MAKE ALL COORDS RELATIVE TO CENTER-OF-SCALING POINT.

         for (var i = 0 ; i < xs.length ; i++)
            xs[i] -= this.tX;
         for (var i = 0 ; i < ys.length ; i++)
            ys[i] -= this.tY;

         for (var n = 0 ; n < this.parsedSrc.length ; n++) {
            var s = this.parsedSrc[n];
            for (var i = 0 ; i < s.length ; i++)
               s[i] = [s[i][0] - this.tX, s[i][1] - this.tY];
         }

         // CREATE CORRESPONDENCE BETWEEN PARSED-SRC STROKES AND PARSED DATA

         var correspondence = [];
         for (var n = 0 ; n < this.parsedSrc.length ; n++) {
            var s = this.parsedSrc[n];
            var p0 = s[0], pn = s[s.length-1];

            var dMin = 100000, lineIndex = -1, pointOrder = 0;

            for (var index = 0 ; index < lines.length ; index++) {
               var a = lines[index][0];
               var b = lines[index][1];

               var aIndex = points[a];
               var bIndex = points[b];

               var ax = xs[aIndex[0]];
               var ay = ys[aIndex[1]];

               var bx = xs[bIndex[0]];
               var by = ys[bIndex[1]];

               var da0 = len(ax - p0[0], ay - p0[1]);
               var dan = len(ax - pn[0], ay - pn[1]);
               var db0 = len(bx - p0[0], by - p0[1]);
               var dbn = len(bx - pn[0], by - pn[1]);

               var order = da0 + dbn < dan + db0 ? 0 : 1;
               var d = order == 0 ? da0 + dbn : dan + db0;
               if (d < dMin) {
                  dMin = d;
                  lineIndex = index;
                  pointOrder = order;
               }
            }
            correspondence.push([lineIndex , pointOrder]);
         }
         this.parsed.push(correspondence);

         // console.log(arrayToString(this.parsed));
      }

      this.xform = function(xy) {
         return [ this.xf[0] + this.xf[4] * ( this.xf[2] * xy[0] + this.xf[3] * xy[1]),
                  this.xf[1] + this.xf[4] * (-this.xf[3] * xy[0] + this.xf[2] * xy[1]) ];
      }

      this.xformInverse = function(xy) {
         var x = (xy[0] - this.xf[0]) / this.xf[4];
         var y = (xy[1] - this.xf[1]) / this.xf[4];
         return [ this.xf[2] * x - this.xf[3] * y, this.xf[3] * x + this.xf[2] * y ];
      }

      this.makeXform = function() {
         this.xf = [ this.tx(),
                     this.ty(),
                     cos(PI * this.rX),
                     sin(PI * this.rX),
                     this.scale() ];
      }

      // DRAW THE PARSED STROKES.

      this.drawParsed = function() {
         this.parsedTransition = min(1, this.parsedTransition + 0.05);
         var parsedTransition = sCurve(this.parsedTransition);

         var xs = this.parsed[0][0];
         var ys = this.parsed[0][1];
         var points = this.parsed[1];
         var lines = this.parsed[2];
         var correspondence = this.parsed[3];

         // RECONSTRUCT COORDINATES OF POINTS.

         this.makeXform();

         var xys = [];
         for (var n = 0 ; n < points.length ; n++)
            xys.push( this.xform([ xs[points[n][0]], ys[points[n][1]] ]) );

         // DRAW THE LINES.

         annotateStart();
         lineWidth(sketchLineWidth * lerp(parsedTransition, 1, .6)
                                   * sketchPage.zoom / this.zoom);

         lineWidth(sketchLineWidth * sketchPage.zoom / this.zoom);

         for (var n = 0 ; n < this.parsedSrc.length ; n++) {
            var s = this.parsedSrc[n];
            var cSrc = [];
            for (var i = 0 ; i < s.length ; i++)
               cSrc.push(this.xform(s[i]));

            var lineIndex = correspondence[n][0];
            var pointOrder = correspondence[n][1];

            var line = lines[lineIndex];
            var a = line[0];
            var b = line[1];
            var s = line[2];
            var cDst = createCurve(xys[a], xys[b],
               abs(s)==loopFlag ? s : s * curvatureCutoff);

            var ab = [];
            for (var u = 0 ; u <= 1 ; u += 0.1) {
               var t = pointOrder == 0 ? u : 1 - u;

               var src = getPointOnCurve(cSrc, u);
               var dst = getPointOnCurve(cDst, t);

               ab.push([lerp(parsedTransition, src[0], dst[0]),
                        lerp(parsedTransition, src[1], dst[1])]);
            }
            curve(ab);
         }

         annotateEnd();
      }

      this.render = function() {
         this.makeXform();
         for (var i = 0 ; i < this.sp.length ; i++) {
            var xy = this.xform(this.sp0[i]);
            this.sp[i][0] = xy[0];
            this.sp[i][1] = xy[1];
         }

         annotateStart();
         lineWidth(sketchLineWidth * sketchPage.zoom / this.zoom);
         _g.strokeStyle = this.color;
         drawSimpleSketch(this);
         annotateEnd();
      }
   }
   SimpleSketch.prototype = new Sketch;

   function Number() {
      this.init = function(str, x, y) {
         this.sp0 = [[0,0]];
         this.sp = [[0,0,0]];
         this.value = str;
         this.isClick = true;
         this.yTravel = 0;
         this.xPrevious = 0
         this.yPrevious = 0
         this.increment = 1;
         this.setText(str);
         this.sketchProgress = 1;
         this.sketchState = 'finished';
         this.textX = this.tX = x;
         this.textY = this.tY = y;
      }

      this.mouseDown = function(x, y) {
         this.yTravel = 0;
         this.xPrevious = x;
         this.yPrevious = y;
      }

      this.ppi = 20; // PIXELS PER INCREMENT, WHEN DRAGGING TO CHANGE VALUE.

      this.mouseDrag = function(x, y) {

         this.yTravel += y - this.yPrevious;
         if (this.yTravel < -this.ppi) {
            var incr = min(1, this.increment);
            this.value = "" + (parseFloat(this.value) + incr);
            this.setText(this.value);
            if (this.text.length > 10)
               this.setText(roundedString(this.value));
            this.yTravel = 0;
         }
         else if (this.yTravel > this.ppi) {
            var incr = min(1, this.increment);
            this.value = "" + (parseFloat(this.value) - incr);
            this.setText(this.value);
            if (this.text.length > 10)
               this.setText(roundedString(this.value));
            this.yTravel = 0;
         }
         this.xPrevious = x;
         this.yPrevious = y;
      }

      this.mouseUp = function(x, y) {
         if (this.isClick) {
            outSketch = this;
            outPort = 0;
            inSketch = null;
            inPort = -1;
         }
         else if (abs(x - this.xDown) > 2 * abs(y - this.yDown)) {
            if (x > this.xDown) {
               this.value = "" + (parseFloat(this.value) / 10);
               this.increment /= 10;
               if (this.increment >= 1)
                  this.value = "" + floor(parseFloat(this.value));
            }
            else {
               this.value = "" + (parseFloat(this.value) * 10);
               this.increment *= 10;
            }
            this.setText(roundedString(this.value));
            this.value = this.text;
         }
      }

      this.insertText = function(textChar) {
         Number.prototype.insertText.call(this, textChar);
         this.increment = 1;
         var i = this.text.indexOf('.');
         if (i >= 0)
            while (++i < this.text.length)
               this.increment /= 10;
      }

      this.render = function() {
         Number.prototype.render.call(this);
         if (isDef(this.inValue[0])) {
            this.setText(roundedString(this.inValue[0]));
            this.value = this.text;
         }
      }
   }
   Number.prototype = new SimpleSketch;

   function isHover() { return isk() && sk().isMouseOver; }
   function isk() { return isDef(sk()) && sk() != null; }
   function nsk() { return sketchPage.sketches.length; }
   function sk(i) { return nsk() == 0 ? null : sketchPage.sketches[i === undefined ? sketchPage.index : i]; }
   function sketchColor() { return sketchPalette[sketchPage.colorIndex]; }

   function clear(context) { clearSketchPage(context); }

   function clearSketchPage(context) {
      sketchPage.fadeAway = 1.0;
   }

   function fadeAwaySketchPage(elapsed) {
      sketchPage.fadeAway = max(0.0, sketchPage.fadeAway - elapsed / 0.25);
      _g.globalAlpha = sketchPage.fadeAway * sketchPage.fadeAway;
      if (sketchPage.fadeAway == 0.0) {
         sketchPage.clear();
         _g.sketchProgress = 1;
         _g.suppressSketching = 0;
         _g.xp0 = _g.yp0 = _g.xp1 = _g.yp1 = 0;
         _g.globalAlpha = 1.0;
      }
   }

   // Continually refresh a canvas, to support animation:

   var saveNoisy, saveLineWidth, saveStrokeStyle, saveFillStyle, saveFont;

   function dataStart() {
      saveNoisy = noisy;
      noisy = 0;
      saveLineWidth = _g.lineWidth;
      saveStrokeStyle = _g.strokeStyle;
      saveFillStyle = _g.fillStyle;
      _g.lineWidth = dataLineWidth;
      _g.strokeStyle = dataColor;
      _g.fillStyle = dataColor;
   }

   function dataEnd() {
      noisy = saveNoisy;
      _g.lineWidth = saveLineWidth;
      _g.strokeStyle = saveStrokeStyle;
      _g.fillStyle = saveFillStyle;
   }

var count = 0;

   function annotateStart(context) {
      if (context === undefined)
         context = _g;

      saveNoisy = noisy;
      noisy = 0;
      saveLineWidth = context.lineWidth;
      saveStrokeStyle = context.strokeStyle;
      saveFillStyle = context.fillStyle;
      saveFont = context.font;
      context.lineWidth = 1;
   }

   function annotateEnd(context) {
      if (context === undefined)
         context = _g;

      noisy = saveNoisy;
      context.lineWidth = saveLineWidth;
      context.strokeStyle = saveStrokeStyle;
      context.fillStyle = saveFillStyle;
      context.font = saveFont;
   }

   var linkAtCursor = null;
   var outSketch = null, inSketch = null;
   var outPort = -1, inPort = -1;

   function findNearestInPort(sketch) {
      return sketch == null ? -1 :
             sketch.portName.length > 0 ? findNearestPortAtCursor(sketch, sketch.in)
                                        : findEmptySlot(sketch.in);
   }

   function findNearestOutPort(sketch) {
      return sketch.portName.length > 0 ? findNearestPortAtCursor(sketch)
                                        : 0;
   }

   function findNearestPortAtCursor(sketch, slots) {
      var x = This().mouseX;
      var y = This().mouseY;
      var n = -1, ddMin = 10000;
      for (var i = 0 ; i < sketch.portName.length ; i++)
         if ((slots === undefined) || slots[i] == null) {
            var xy = sketch.portXY(i);
            var dd = (xy[0]-x)*(xy[0]-x) + (xy[1]-y)*(xy[1]-y);
            if (dd < ddMin) {
               n = i;
               ddMin = dd;
            }
         }
      return n;
   }

   function findPortAtCursor(sketch, slots) {
      if (sketch instanceof Number ||
          sketch instanceof SimpleSketch &&
                 (! sketch.isNullText() || isDef(sketch.inValue[0])))
         return sketch.isMouseOver ? 0 : -1;
      var x = This().mouseX;
      var y = This().mouseY;
      for (var i = 0 ; i < sketch.portName.length ; i++)
         if ((slots === undefined) || slots[i] == null) {
            var xy = sketch.portXY(i);
            if ( x >= xy[0] - portHeight/2 && x < xy[0] + portHeight/2 &&
                 y >= xy[1] - portHeight/2 && y < xy[1] + portHeight/2 )
               return i;
         }
      return -1;
   }

   var tick = function(g) {
      document.body.scrollTop = 0;
      if (isDef(window[g.name].animate)) {
         document.body.style.cursor =
            isExpertMode && (isPieMenu || isSketchInProgress()) ? 'none' :
	    bgClickCount == 1 ? 'cell' : 'crosshair';

         var w = width(), h = height();

         var prevTime = time;
         time = ((new Date()).getTime() - _startTime) / 1000.0;
         This().elapsed = time - prevTime;

         if (pieMenuCursorWeight > 0) {
            pieMenuCursorWeight = max(0, pieMenuCursorWeight - This().elapsed);
            pieMenuX = lerp(pieMenuCursorWeight, This().mouseX, pieMenuXDown);
            pieMenuY = lerp(pieMenuCursorWeight, This().mouseY, pieMenuYDown);
            if (pieMenuCursorWeight == 0)
               isPieMenu = false;
         }

         // CLEAR THE CANVAS

         _g = g;
         _g.clearRect(0, 0, w, h);
         _g.inSketch = false;

         if (sketchPage.isWhiteboard) {
            color(backgroundColor);
            fillRect(0, 0, w, h);
         }

         // START OFF CURRENT GUIDED SKETCH, IF NECESSARY

         if (isk() && sk().sketchState == 'start') {
            _g.isDrawing = false;
            sk().cursorTransition = 0;
            sk().styleTransition = 0;
            sk().sketchLength = 1;
            sk().sketchProgress = 0;
            sk().tX = This().mouseX - width()/2;
            sk().tY = This().mouseY - height()/2;
            sk().xStart = cursorX = _g.mouseX = This().mouseX;
            sk().yStart = cursorY = _g.mouseY = This().mouseY;
            sk().sketchState = 'in progress';
         }

         if (isk() && sk().sketchState == 'in progress'
                   && isSketchDrawingEnabled
                   && sk().sketchProgress == 0) {
            _g.mouseX = This().mouseX; 
            _g.mouseY = This().mouseY; 
         }

         // ANIMATE AND DRAW ALL THE STROKES

         for (var I = 0 ; I < nsk() ; I++)
            if (! sk(I).isSimple()) {
               sk(I).sp = [[sk(I).xStart, sk(I).yStart, 0]];
               sk(I).dSum = 0;
            }

         if (! isPullDown && This().mouseX < glyphsW && This().mouseY >= h - glyphsH)
            isShowingGlyphs = true;
         else if (This().mouseY < height() - glyphsH)
            isShowingGlyphs = false;

         var saveAlpha = _g.globalAlpha;
         _g.globalAlpha = 1;
         color(backgroundColor);
	 fillRect(0,0,w,10);
	 fillRect(0,0,10,h);
	 fillRect(0,h-10,w,10);
	 fillRect(w-10,0,10,h);
         _g.globalAlpha = saveAlpha;

         if (! isShowingGlyphs)
            This().animate(This().elapsed);
         else if (isExpertMode)
	    sketchPage.showGlyphs();

         for (var I = 0 ; I < nsk() ; I++)
            if (! sk(I).isSimple())
               sk(I).sketchLength = sk(I).dSum;

         // COMPUTE SKETCH BOUNDING BOXES.

         if (! isPullDown) {
            isMouseOverBackground = true;
            for (var I = 0 ; I < nsk() ; I++) {
               if (! sk(I).isGroup() && sk(I).parent == null) {

                  var xlo = 10000;
                  var ylo = 10000;
                  var xhi = -10000;
                  var yhi = -10000;
                  for (var i = 1 ; i < sk(I).sp.length ; i++) {
                     xlo = min(xlo, sk(I).sp[i][0]);
                     xhi = max(xhi, sk(I).sp[i][0]);
                     ylo = min(ylo, sk(I).sp[i][1]);
                     yhi = max(yhi, sk(I).sp[i][1]);
                  }
                  xlo = izpx(xlo);
                  ylo = izpy(ylo);
                  xhi = izpx(xhi);
                  yhi = izpy(yhi);

                  // PORTS EXTEND THE BOUNDING BOX OF A SKETCH.

                  for (var i = 0 ; i < sk(I).portName.length ; i++) {
                     if (sk(I).portBounds[i] === undefined)
                        continue;
                     xlo = min(xlo, sk(I).portBounds[i][0]);
                     ylo = min(ylo, sk(I).portBounds[i][1]);
                     xhi = max(xhi, sk(I).portBounds[i][2]);
                     yhi = max(yhi, sk(I).portBounds[i][3]);
                  }

                  // TEXT EXTENDS THE BOUNDING BOX OF A SKETCH.

                  if (sk(I).text.length > 0) {
                     var rx = sk(I).scale() * sk(I).textWidth / 2;
                     var ry = sk(I).scale() * sk(I).textHeight / 2;
                     var x1 = lerp(sk(I).scale(), sk(I).tx(), sk(I).textX);
                     var y1 = lerp(sk(I).scale(), sk(I).ty(), sk(I).textY);
                     xlo = min(xlo, x1 - rx);
                     ylo = min(ylo, y1 - ry);
                     xhi = max(xhi, x1 + rx);
                     yhi = max(yhi, y1 + ry);
                  }
                  else if (sk(I).sp.length <= 1) {
                     xlo = xhi = sk(I).cx();
                     ylo = yhi = sk(I).cy();
                  }

                  sk(I).xlo = zpx(xlo - sketchPadding);
                  sk(I).ylo = zpy(ylo - sketchPadding);
                  sk(I).xhi = zpx(xhi + sketchPadding);
                  sk(I).yhi = zpy(yhi + sketchPadding);
               }

               sk(I).isMouseOver = sk(I).parent == null &&
                                   This().mouseX >= sk(I).xlo &&
                                   This().mouseX <  sk(I).xhi &&
                                   This().mouseY >= sk(I).ylo &&
                                   This().mouseY <  sk(I).yhi ;

               // IF MOUSE IS OVER ANY SKETCH, THEN IT IS NOT OVER BACKGROUND.

               if (sk(I).isMouseOver)
                  isMouseOverBackground = false;
            }
         }

         // SELECT FRONTMOST SKETCH AT THE CURSOR.

         if (! isPullDown && isFinishedDrawing()
                          && letterPressed == '\0'
                          && sketchAction == null)
            for (var I = nsk() - 1 ; I >= 0 ; I--)
               if (sk(I).isMouseOver && sk(I).sketchState == 'finished') {
                  selectSketch(I);
                  break;
               }

         // HANDLE TEXT SHORTHAND MODE TIMEOUT

         if (isTextMode && time - strokesStartTime >= 0.5)
            isShorthandTimeout = true;
            
         // HANDLE THE AUDIENCE POPUP VIEW

         if (isAudiencePopup() || ! isShowingOverlay()) {

            annotateStart();

            // START DRAWING A POSSIBLE NEW LINK.

            if ( linkAtCursor == null
                 && isk()
                 && sketchAction == "linking"
                 && outSketch != null
                 && outPort >= 0 )
               drawPossibleLink(outSketch, sketchPage.mx, sketchPage.my);

            // DRAW ALL EXISTING LINKS.

            if (! sketchPage.isPressed)
               linkAtCursor = null;

            for (var I = 0 ; I < nsk() ; I++)
               if (sk(I).parent == null) {
                  var a = sk(I);
                  for (var i = 0 ; i < a.out.length ; i++)
                     if (isDef(a.out[i]))
                        for (var k = 0 ; k < a.out[i].length ; k++) {
                           var b = a.out[i][k][0];
                           var j = a.out[i][k][1];
                           var s = a.out[i][k][2];
                           drawLink(a, i, a.out[i][k], true);
                           if (! this.isPressed && isMouseNearCurve(a.out[i][k][4]))
                              linkAtCursor = [a, i, k, a.out[i][k]];
                        }
               }

            annotateEnd();
         }

         if (isExpertMode) {
            if (isPieMenu)
               drawCrosshair(pieMenuX, pieMenuY);
            else if (isSketchInProgress())
               drawCrosshair(cursorX, cursorY);
         }

         if (isAudiencePopup()) {

            // DRAW A CURSOR WHERE AUDIENCE SHOULD SEE IT.

            if (isPullDown)
               drawCrosshair(pullDownX, pullDownY);
            else if (isSketchInProgress())
               drawCrosshair(cursorX, cursorY);
            else
               drawCrosshair(This().mouseX, This().mouseY);

            // SHOW AUDIENCE VIEW.

            if (! isShowingPresenterView) {
               audienceContext.clearRect(0, 0, width(), height());
               if (sketchPage.isWhiteboard) {
                  audienceContext.fillStyle = backgroundColor;
                  audienceContext.fillRect(0, 0, width(), height());
               }
               audienceContext.drawImage(_g.canvas, 0, 0);
            }
         }

         // DRAW WIDGET THAT TOGGLES WHETHER TO SHOW OVERLAY.

         annotateStart();
         if (This().mouseX >= width() - 50 && This().mouseY <= 50) {
            color('rgba(192,192,192,0.2)');
            fillRect(width() - 51, 1, 50, 50);
         }
         color(dataColor);
         drawRect(width() - 51, 1, 50, 50);
         annotateEnd();

         // PROPAGATE LINK VALUES.

         for (var I = 0 ; I < nsk() ; I++) {
            var a = sk(I);
            if (a instanceof SimpleSketch && isDef(a.out[0]))
               if (a.isNullText())
                  a.outValue[0] = a.inValue[0];
               else
                  try {
                     var result = eval(a.text.replace(/x/g, '('+value(a.inValue[0])+')')
                                             .replace(/y/g, '('+value(a.inValue[1])+')')
                                             .replace(/z/g, '('+value(a.inValue[2])+')'));
                     if (isNumber(parseFloat(result)))
                        a.outValue[0] = result;
                  } catch (e) { }

            // EACH PORT'S VALUES PROPAGATE FROM ITS INPUT TO ITS OUTPUT.

            else for (var i = 0 ; i < a.in.length ; i++)
               a.outValue[i] = a.inValue[i];

            // VALUES PROPAGATE ALONG LINKS.

            for (var i = 0 ; i < a.out.length ; i++)
               if (isDef(a.out[i])) {
                  var outValue = value(a.outValue[i]);
                  for (var k = 0 ; k < a.out[i].length ; k++) {
                     var b = a.out[i][k][0];
                     var j = a.out[i][k][1];
                     b.inValue[j] = outValue;
                  }
               }
         }

         sketchPage.computePortBounds();
         if (isShowingOverlay())
            This().overlay();
         sketchPage.advanceCurrentSketch();

         if (isAudiencePopup() && isShowingPresenterView) {
            audienceContext.fillStyle = backgroundColor;
            audienceContext.fillRect(0, 0, width(), height());
            audienceContext.drawImage(_g.canvas, 0, 0);
         }

         requestAnimFrame(function() { tick(g); });
      }
   }

   var ef = new EncodedFraction();

   function EncodedFraction() {
      this.chars = "";
      for (i = 32 ; i < 127 ; i++) {
         var ch = String.fromCharCode(i);
         switch (ch) {
         case '\\':
         case '"':
            break;
         default:
            this.chars += ch;
            break;
         }
      }
      this.encode = function(t) {
         t = max(0, min(1, t));
         var i = floor((this.chars.length - 1) * t + 0.5);
         return this.chars.substring(i, i+1);
      }

      this.decode = function(ch) {
         return this.chars.indexOf(ch) / (this.chars.length - 1);
      }
   }

   var isTest = false;

   function isSketchInProgress() {
      return isk() && sk().sketchState == 'in progress';
   }

   function isShowingOverlay() {
      return ! isExpertMode &&
             ( isShowingGlyphs || isDef(This().overlay) );
   }

   var glyphsW = 80;
   var glyphsH = 100;
   var isShowingGlyphs = false;

   var timelineH = 80;
   var isShowingTimeline = false;
   var isDraggingTimeline = false;

   function drawSimpleSketch(sketch, context) {
      if (context === undefined)
         context = _g;

      context.save();

      if (sketch.isParsed())
         sketch.drawParsed();
      else {
         var sp = sketch.sp;
         var isCard = sketch.isCard;

         context.beginPath();
	 var strokeIndex = -1;
         for (var i = 0 ; i < sp.length ; i++) {
            if (sp[i][2] == 0) {
               context.moveTo(sp[i][0], sp[i][1]);
	       strokeIndex++;
	       if (strokeIndex < sketch.colorIndex.length)
	          context.strokeStyle = sketchPalette[sketch.colorIndex[strokeIndex]];
            }
            else {
               context.lineTo(sp[i][0], sp[i][1]);
               if (isCard && (i == sp.length - 1 || sp[i+1][2] == 0)) {
                  context.stroke();
                  var i0 = i - 1;
                  while (i0 > 1 || sp[i0][2] == 1)
                     i0--;
                  context.fillStyle = sketch.isNegated ? sketch.color : backgroundColor;
                  fillPath(sp, i0, i, context);
                  if (sketch.isNegated)
                     context.strokeStyle = backgroundColor;
                  isCard = false;
                  context.beginPath();
               }
            }
         }
         context.stroke();
      }

      sketch.drawText(context);

      if (sketch.isGroup()) {
         color('rgba(255,1,0,.07)');
         fillRect(sketch.xlo, sketch.ylo, sketch.xhi-sketch.xlo,
                                          sketch.yhi-sketch.ylo);
      }

      context.restore();
   }

   function fillPath(sp, i0, i1, context) {
      if (context === undefined)
         context = _g;
      context.beginPath();
      var offset = context.lineWidth * 0.35;
      context.moveTo(sp[i0][0] - offset, sp[i0][1] - offset);
      for (var i = i0 + 1 ; i <= i1 ; i++)
         context.lineTo(sp[i][0] - offset, sp[i][1] - offset);
      context.fill();
   }

   var isSketchDrawingEnabled = false;
   var letterPressed = '\0';

   var textEditorPopup = null, textEditorTextArea;
   var audiencePopup = null, audienceCanvas, audienceContext;
   var cursorX = 0, cursorY = 0;

   function deleteSketch(sketch) {
      if (sketch === undefined)
         return;

      for (var j = 0 ; j < sketch.children.length ; j++) {
         var k = sketchPage.findIndex(sketch.children[j]);
         sketchPage.sketches.splice(k, 1);
      }
      deleteSketchOnly(sketch);
   }

   function deleteSketchOnly(sketch) {

      var i = sketchPage.findIndex(sketch);
      if (i >= 0) {
         if (sketch.cleanup != null)
            sketch.cleanup();

         sketchPage.sketches.splice(i, 1);
         _g.isDrawing = false;

         var s, j, k;

         // DELETE OUT LINKS TO THIS SKETCH WITHIN OTHER SKETCHES:

         for (var inPort = 0 ; inPort < sketch.in.length ; inPort++)
            if (isDef(sketch.in[inPort])) {
               var s = sketch.in[inPort][0];
               for (var outPort = 0 ; outPort < s.out.length ; outPort++)
                  if (isDef(s.out[outPort]))
                     for (var k = s.out[outPort].length - 1 ; k >= 0 ; k--)
                        deleteOutLink(s, outPort, k);
            }

         // DELETE IN LINKS FROM THIS SKETCH WITHIN OTHER SKETCHES:

         for (var outPort = 0 ; outPort < sketch.out.length ; outPort++)
            if (isDef(sketch.out[outPort]))
               for (k = sketch.out[outPort].length - 1 ; k >= 0 ; k--) {
                  var inSketch = sketch.out[outPort][k][0];
                  var inPort   = sketch.out[outPort][k][1];
                  deleteInLink(inSketch, inPort);
               }
      }
      if (sketchPage.index >= nsk())
         selectSketch(nsk() - 1);
   }

   function selectSketch(n) {
      sketchPage.index = n;
      if (n >= 0)
         pullDownLabels = sketchActionLabels.concat(sk().labels);
   }

   function copySketch(s) {
      if (s === undefined || s == null)
         return;

      var children = null, groupPath = [];

      if (s.isGroup()) {
         children = [];
         for (var i = 0 ; i < s.children.length ; i++) {
            copySketch(s.children[i]);
            children.push(sk());
            sk().tX = s.children[i].tX;
            sk().tY = s.children[i].tY;
         }

         groupPath = cloneArray(s.groupPath);
      }

      addSketch(s.clone());
      sk().sketchProgress = 1;
      sk().sketchState = 'finished';

      var dx = This().mouseX - (s.isGroup() ? s.cx() : s.tx());
      var dy = This().mouseY - (s.isGroup() ? s.cy() : s.ty());

      if (s.isGroup()) {
         sk().xlo += dx;
         sk().ylo += dy;
         sk().xhi += dx;
         sk().yhi += dy;

         sk().children = [];
         for (var i = 0 ; i < children.length ; i++) {
            sk().children.push(children[i]);
            sk().children[i].parent = sk();
         }
         moveChildren(sk().children, dx, dy);

         for (var i = 0 ; i < groupPath.length ; i++) {
            groupPath[i][0] += dx;
            groupPath[i][1] += dy;
         }
         sk().groupPath = groupPath;
      }
      else {
         sk().tX += dx;
         sk().tY += dy;
         if (! sk().isSimple()) {
            sk().tX -= width() / 2;
            sk().tY -= height() / 2;
         }
         sk().textX += dx;
         sk().textY += dy;
      }
   }

   function addSketch(sketch) {
      sketchPage.add(sketch);
      sk().id = globalSketchId++;
      sk().color = sketchColor();
      sk().sketchState = 'start';
      sk().children = [];
      sk().in = [];
      sk().out = [];
      sk().inValue = [];
      sk().outValue = [];
      sk().portBounds = [];
      sk().portLocation = [];
      sk().zoom = sketchPage.zoom;
      isSketchDrawingEnabled = false;
      if (sk() instanceof Sketch2D) {
         sk().x2D = This().mouseX;
         sk().y2D = This().mouseY;
      }
   }

   function cloneArray(src) {
      var dst = [];
      for (var i = 0 ; i < src.length ; i++)
         if (src[i] instanceof Array)
            dst[i] = cloneArray(src[i]);
         else
            dst[i] = src[i];
      return dst;
   }

   function computeCurveLength(sp, i0, i1) {
      if (i0 === undefined) i0 = 0;
      if (i1 === undefined) i1 = sp.length;
      var len = 0;
      for (var i = i0 ; i < i1 - 1 ; i++) {
         var dx = sp[i+1][0] - sp[i][0];
         var dy = sp[i+1][1] - sp[i][1];
         len += sqrt(dx * dx + dy * dy);
      }
      return len;
   }

   function bendCurve(sp, pt, len, i0) {
      if (i0 === undefined) i0 = 0;
      var n = sp.length;
      var dx0 = pt[0] - sp[1][0];
      var dy0 = pt[1] - sp[1][1];
      var dx1 = pt[0] - sp[n-1][0];
      var dy1 = pt[1] - sp[n-1][1];
      if (dx0 * dx0 + dy0 * dy0 < dx1 * dx1 + dy1 * dy1)
         for (var i = n-2 ; i >= i0 ; i--) {
            var t = (n-1-i) / (n-2);
            sp[i][0] += t * dx0;
            sp[i][1] += t * dy0;
         }
      else
         for (var i = i0 + 1 ; i <= n-1 ; i++) {
            var t = (i-1) / (n-2);
            sp[i][0] += t * dx1;
            sp[i][1] += t * dy1;
         }
      adjustLength(sp, len, i0);
   }

   function computeCentroid(parent, sk, pts) {
      var xlo = sk.xlo;
      var ylo = sk.ylo;
      var xhi = sk.xhi;
      var yhi = sk.yhi;

      var x = 0, y = 0, sum = 0;
      for (var i = 0 ; i < pts.length ; i++)
         if ( pts[i][0] >= xlo && pts[i][0] < xhi &&
              pts[i][1] >= ylo && pts[i][1] < yhi ) {
            x += pts[i][0];
            y += pts[i][1];
            sum++;
         }

      if (sum == 0) {
         x = (xlo + xhi) / 2;
         y = (ylo + yhi) / 2;
      }
      else {
         x /= sum;
         y /= sum;
      }
      return [parent.m2x(x), parent.m2y(y)];
   }

   function adjustLength(sp, targetLength, i0) {
      var n = sp.length;

      var ratio = targetLength / computeCurveLength(sp, i0);

      var x0 = (sp[1][0] + sp[n-1][0]) / 2;
      var y0 = (sp[1][1] + sp[n-1][1]) / 2;

      var p = [];
      for (var i = 0 ; i < n ; i++)
         p.push([sp[i][0], sp[i][1]]);

      for (var i = 2 ; i <= n-2 ; i++) {
         var t = 1 - 4*(i-n/2)*(i-n/2)/n/n;
         var dr = t * (ratio - 1) + 1;
         p[i][0] = lerp(dr, x0, p[i][0]);
         p[i][1] = lerp(dr, y0, p[i][1]);
      }

      for (var i = 2 ; i <= n-2 ; i++) {
         sp[i][0] = p[i][0];
         sp[i][1] = p[i][1];
      }
   }

// HANDLE TEXT EDITOR POP-UP WINDOW.

   var updateTextEditor = function() {
      try {
         eval(textEditorTextArea.value);
      } catch (e) { }
   };

   function isTextEditorPopup() {
      return textEditorPopup != null;
   }

   function createTextEditorPopup() {
      var w = _g.canvas.width;
      var h = _g.canvas.height;
      textEditorPopup = window.open("", "textEditorPopup", ""
      +  " width=" + floor(w / 2)
      +  " height=" + floor(h / 2)
      );
      textEditorPopup.document.write( ""
          + "<head><title>TEXT EDIT</title></head>"
	  + "<body>"
          + "<textArea rows=18 cols=55 height=100 id=textEditor_text"
          + " style='background-color:transparent;border:none'"
	  + "</textArea>"
          + "</body>"
      );
      textEditorPopup.blur();

      textEditorTextArea = textEditorPopup.document.getElementById("textEditor_text");
      textEditorTextArea.onchange = 'console.log("button clicked")';
      textEditorTextArea.style.borderColor = backgroundColor;
      textEditorTextArea.style.font="18px courier";
      textEditorTextArea.style.color="blue";
      textEditorTextArea.value = "This is some text!";
      textEditorTextArea.onkeyup = function() { console.log("HI MOM"); }
   }

   function removeTextEditorPopup() {
      textEditorPopup.close();
      textEditorPopup = null;
   }

// HANDLE AUDIENCE POP-UP WINDOW.

   function isAudiencePopup() {
      return audiencePopup != null;
   }

   function createAudiencePopup() {
      var w = _g.canvas.width;
      var h = _g.canvas.height;
      audiencePopup = window.open("", "audiencePopup", ""
      +  " width=" + w
      +  " height=" + (h+52)
      );
      audiencePopup.moveTo(0, 832);
      audiencePopup.document.write( ""
      +  " <head><title>SKETCH</title></head>"
      +  " <body>"

      +  " <table width=" + (w-24) + " height=" + (h+24) + " cellspacing=0 cellpadding=0"
      +  " style='z-index:1;position:absolute;left:0;top:0;'>"
      +  " <tr><td id='slide' align=center valign=center>"
      +  " </td></tr></table>"

      +  " <canvas id=audienceCanvas"
      +  " width=" + (w - 24)
      +  " height=" + h
      +  " style='z-index:1;position:absolute;left:0;top:0;'"
      +  " tabindex=1></canvas>"

      +  " </body>"
      );
      audienceCanvas = audiencePopup.document.getElementById("audienceCanvas");
      audienceContext = audienceCanvas.getContext("2d");
      audiencePopup.blur();
   }

   function removeAudiencePopup() {
      audiencePopup.close();
      audiencePopup = null;
   }

// HANDLE FAKE CROSSHAIR CURSOR.

   function drawCrosshair(x, y, context) {
      if (context === undefined)
         context = _g;

      var r = 6.5 * window.innerWidth / window.outerWidth;

      x = floor(x);
      y = floor(y);

      for (var n = 0 ; n < 2 ; n++) {
         context.strokeStyle = n == 0 ? backgroundColor : defaultPenColor;
         context.lineWidth = (n == 0 ? .3 : .1) * r;
         context.beginPath();
         context.moveTo(x - r, y);
         context.lineTo(x + r, y);
         context.moveTo(x, y - r);
         context.lineTo(x, y + r);
         context.stroke();
      }
   }

// VARIOUS MANIPULATIONS OF HTML ELEMENTS.

   // Replace the text of an html element:

   function replaceText(id, newText) {
      document.getElementById(id).firstChild.nodeValue = newText;
   }

   // Set the document's background color:

   function setBackgroundColor(color) {
      document.body.style.background = color;
   }

   // Give "text-like" style to all the buttons of a document:

   function textlike(tagtype, textColor, hoverColor, pressColor) {
      var buttons = document.getElementsByTagName(tagtype);
      for (var i = 0 ; i < buttons.length ; i++) {
         var b = buttons[i];
         b.onmousedown = function() { this.style.color = pressColor; };
         b.onmouseup   = function() { this.style.color = hoverColor; };
         b.onmouseover = function() { this.style.color = hoverColor; };
         b.onmouseout  = function() { this.style.color = textColor; };
         b.style.border = '0px solid black';
         b.style.outline = '0px solid black';
         b.style.margin = 0;
         b.style.padding = 0;
         b.style.color = textColor;
         b.style.fontFamily = 'Helvetica';
         b.style.fontSize = '12pt';
         b.style.backgroundColor = document.body.style.background;
      }
   }

   // Object that makes a button cycle through a set of choices:

   function choice(id,      // id of the button's html tag
                   data) {  // data is an array of strings
      this.index = 0;
      this.data = (typeof data === 'string') ? data.split('|') : data;

      // The button that this choice object will control:

      var button = document.getElementById(id);

      // The button needs to know about this choice object:

      button.choice = this;

      // Initially, set the button's text to the first choice:

      button.firstChild.nodeValue = this.data[0];

      // Every click will set the button's text to the next choice:

      button.onclick = function() {
         var choice = this.choice;
         choice.index = (choice.index + 1) % choice.data.length;
         this.firstChild.nodeValue = choice.data[choice.index];
      }
   }

   function getSpan(id) {
      return document.getElementById(id).firstChild.nodeValue;
   }

   function setSpan(id, str) {
      document.getElementById(id).firstChild.nodeValue = str;
   }

   var _g, time = 0, _startTime = (new Date()).getTime();

   var glyphCountBeforePage = 0;

   function setPage(index) {

      // REMOVE ALL GLYPHS DEFINED FROM PREVIOUS PAGE, IF ANY.

      if (glyphCountBeforePage > 0)
         glyphs.splice(glyphCountBeforePage, glyphs.length - glyphCountBeforePage);
      glyphCountBeforePage = glyphs.length;

      ////////////////////////////////////////////////////////

      if (index === undefined)
         index = pageIndex;

      pageIndex = (index + pages.length) % pages.length;

      sketchPage = sketchBook.setPage(pageIndex);
      var pageName = pages[pageIndex][0];
      var slide = document.getElementById('slide');
      slide.innerHTML = document.getElementById(pageName).innerHTML;

      if (audiencePopup != null)
         audiencePopup.document.getElementById('slide').innerHTML =
            document.getElementById(pageName).innerHTML;

      // SET SKETCH TYPES FOR THIS PAGE.

      sketchTypes = pages[pageIndex][1];
      pagePullDownLabels = pageActionLabels.concat(sketchTypes);
      pullDownLabels = pagePullDownLabels;

      sketchTypeLabels = [];
      for (var n = 0 ; n < sketchTypes.length ; n++)
         registerSketch(sketchTypes[n]);
   }

var glyphData = [
"a",
["P*N+L*H*E)C(@'=':'6'3(1).*++)-'0%2$5#8!; > A D G J M P!S#V$Y%]&`(b)e+h,j-m/p1r3u5v8w;x>xAxDwFuIsJpLnMkNhOePcQ`S]TYTVUSVPWMWJXGXDXAX>W;V8U5T2S/R-Q*O(O+O.O1P4R6S9T<V?WAYD[F]I_LaNbQdSfVhXkZm]p^s_u`xa{b~c"],
"b",
["3!3!5$6&6(7*7,7/718385878:9<9>9@:C:E;G;I<L<N=P=R>T>W?Y?[?^?a@c@eAgAiAlAnBpBrCuCwDyDxCvCtBrBoBmBkBhCfDdEbF`G^H[JZLXMWOVRUTUVTXT[T^T`TbUdVfWhXiZj]k_kaldlflhljkmkojqishugwfyd{c|`}^}[~Y~W~T~R~P}N|L{JzHxGw"],
"c",
["n%l%j%h%f$d$b#_#]!Z!X V T R O M K I G E C!A#?$=%;&9'7(6*5+3-2/10/2.4-6+7*9);(=(?'A'C'E'G'I'L'N'P(R(T(V(X)Z*]*`+a,c.e.g/i0k1m2n4p5r6t8u9w;x<z>{@|B}D~F~H~J~L~O~Q~S~U~W~Y~]~_~a~c~e~g}i}k|m{ozqxswuwwvxuxw"],
"d",
["ZRXPUORNONLMJMGMDMAL>M<O9P7R5T3V1X0[0_0b0e0h0j2m3o5r7t9v;x=z?|A}D~G}I{KyMwNtPrQoSmTjTgTdUaU^VZVXVUWRWOWLWIWFVCVAU>T;T8T5S2S0S-S*S'S$R R$R'R*S,S/S2T5T8T;U>UAVCWFWIXLYOYRZT[W]Z^^_``cafbhdkemfphrjtlvnxoz"],
"e",
["<B=E>H@JBMDOFQHSKUNUQVTVWVYV]U`TcSeQgOiMkJmHoFpDrAs>s;s8r5q3p0n.l+j)h(e&b%`$]#Y!V S P M J G E!B#?%=&:(8)6+4.2003/5.8-;,>+A+D+F+I+L,O,R,U,X-[-_.b/e1g2j4l6n7q:s<t?uBvEwHxJyMzP{S}U~X~[~_}b|d{gzixlwnuqttr"],
"f",
["AXCXEVFTHSJRKPMONMPKQJRHSFTDUBW@X>Y=Z;[9]7]5^2^0^.^,^*]([%Z$Y!W U!T$S&R(Q*P,O.O0O2N4N6N9N;N=N?NANDNFNHNJNLNNNQNSNUNWNYO]O_OaOcOePgPjQlQnQpRrRtRwSyT{U|V~X~Y|Zz[x[v]t]q]o]m]k^i^f]d]b[`[^Z[YYXWVVTTRTPSNT"],
"g",
["]']&Z$X!V!S Q N L I G!D#B%@&>(<);,:.909395989;9=9@:B;E<G=I?KALCMFNHMKMMLOJQHRFTDUBV@X=Y;Z9Z6[4[1]/],^*^'^*^,^/^1_4`6`9a;a>b@bCcEdHdJeMeOeReUeWfZf]f`fbfefgfjfmfoerdtcvax`z^|Z}X}V~S~P~N~K~I~F~D}A}?|={;y"],
"h",
["< <#<%<'<)=+=,=.=0>2>4>6>8>:?<?>?@?B?D?F?G@I@K@M@O@Q@S@U@W@Y@[@^@`@b@c@e@g@i@k@m@o@q@s@u@w@y@{A|A~A|AzAxAvAtArApBnBlBjBhCgCeDcDaE_F^H[IZKYLWNVOUQUSTUTWSYSZT]U^W^Y_[_^```a`caeagaibkbmbocqcscucvcxczc|c{"],
"i",
[" s#q%p&o(n*l+k-i/h0f2e4d6b7a9_:];[=Y>W@VATBRCPENFMHKIIJGLFMDOCPAR?S>T<V:W8X7Z5[3[1]/^-_+_(`&`$a#a%`(`*`,_.^0^2^5]7]9[;[=[?[B[D[F[H[J[M[O[Q[S[V[X[Z[][_[b[d[f[h]j^l_n`parbtcvewgyhzj{l|n|p|s|u|w|y|{{}z~{"],
"j",
["a b!b$b%b&c(c)c*c,c-d/d0d1d3d4d5e7e8e9e;e<e>f?f@fBfCfDfFfGgHgJgKgMgNgOgQgRgSgUgVhXhYhZh]h^h_hahbhdhehfhhhigjglgmgngpgqgsgtfuevdwcxbyaz`z_{]{[|Z|X}W}V}T}S}R}P}O}N}L~K~I~H~G~E~D}C}B|@{?{>z=y<y:x9w9v8u8u"],
"k",
["? ?#?&?(?*?-@/@1@4@6@9@;A=A@ABAEBGBIBLBNBPBSBUBXBZB]B`BbBeBgBiBlBnBqBsBuBxBzB|C}D{DyEvEtErFoFmFjFhGfHdHaI_J]KZLWMUNSNQONPLRJSHSFUDVBWBVDUFTHRJQLPNOQMRLTJVIXGZE[D^C`BbCdEdHeIfKhMjNkPmRoTpUrWtYuZw]y_z`|"],
"l",
["N N!N#N$N$N%N&N'N(N)N*N+N,N-N.N/N0N1N2N2N3O4O5O6O7O8O9O:O;O<O=O>O?O@O@OAOBOCODOEOFOGOHOIOJOKOLOMOMONOOOPOQOROSOTPUPVPWPXPYPZP[P[P]P^P_P`PaPbPcPdPePfPgPhPiPjPjPkPlPmPnPoPpPqPrPsPtPuPvPwPwPxPyPzP{P|P}P~"],
"m",
[" )!-#0$4$8%<&?&C&G'K'O(R(V)Z)_)c*f*j*n*l+i,e,a,],X,U-Q.M/J0F1B3?5<8:<7?5B3E1H0L1O3P7R:S>TBUEUIVMVQVTVXV]VaVeViVlVpVrVnVjVfUbT_TZTVURVOVKXGYDZ@]=^9`6c3f0i.l,o*r,t/v3v7x:y>zAzE{I{M|Q|T|X}]}a~e~h~l~p~t~t"],
"n",
["( *#+&,),,-/-2.5.8/;/=0@0C0F1I1L1O1R1U1X1[2_2b2e3h3k4n4q5s5v5y5|5}5z5w4t4q4n4k4h4e4b4_4[5X5U6S7P7M7J8G9D:A;?<<>9@7B5D3F2H/K-M,P+R*U(X'Z&^&a&c(e*f-h/i2j5k8l:n=o@oCpEqHqKqNrQrTsWsZt^tatcufuiuluouruuuxw{"],
"o",
["]![!Y!V S P M J G D A >#<$:&8)6*3,1./0-2+4*7):(=(@(C(E(H(K(N(Q)T*W+Z,^-`.c/f0h2k3n5p7r9t;v=x@zB{E|H}K}M~P~S}V|Xz[y^wavduguirkpmnnlpiqgrdtat^u[vXvUwRwOwLwIwFwCw@w=v;v8t5s3q0o.m,j*h)e'c&`%]$Y#W T R!O#O%"],
"p",
[";$<'<)<,=/=2=5=7=:===@=B>E>H>K>N>P>S?V?Y?[?_?b@eAgAjAmApBsBuBxB{C}C|CyBvBtBqAnAk@i@f@c@`@^@Z@W@T@Q@O@L@I@F?D?A?>?;?8>6>3>0?.@+A(C&D$F!I L N Q!T!V$X&Z'])_+a.b0c3d5d8d;c=c@cCbFbH`K^M]OZQXSVUSVPVNWKWHWEW"],
"q",
["V$T#R!O M K!H!F#C#A#>$<&;(9*8,8/717476797;7>7@7C9E:G;I=K>MAMCLEKGJIHJEKCLAM?N<O:O7P5P2P0P-P+P(Q&Q#Q!Q%R'R*R,R/R1R4R6S9S;S>S@TCTETHTJTMTOURUUUWUZV]V`WbWdWgXiXlXnYqYsYvYxY{Z}Z|[z[w]u^r_p`nalbicgdeecg`h_"],
"r",
[". /#/%/'0*0,0.00131517192<2>2@2B3E3G3I3K3N3P3R3T3W3Y3[3^3a3c3e3g3j3l3n3q3s3u3w3z3|4~4|4z4w4u4s4q4n4l4j4h4e4c4a4_5]6Z7W7U8S9Q9O9L9J9H9F:D;A;?<==;>9@7A6B4D2E0F/H-J,L+N*P*R)U)W(Y([(^(a(c(e(h(j(l)n)p*p+n,"],
"s",
["[ Y X!W!V#U#T$T%S&R'Q'P(O(O)N*N+M,M-M/L0L1L2K3K4J5J6I7I8I:I;I<I=I>I?I@IBJCJDJEKFKGLHLIMJMKNLNMONOOOPPRPSQTQURVRWSXTXUYUZU]U^V_V`WaWbWcWdWeWgWhWiWjVkVlVmVoUpUqUrTsTtSuRvRwQxPxOyNzMzL{K{J|I|H|G}G}F}D}D~"],
"t",
["*$+%-&/&1&3&5&8&:&<&>&@&B&D&F%H%J%L%N%P%S%U%W$Y$[#^#`#b#d#f#h!j!l!n p r t s q o m!k!i#g#e$c$a$_%]%Z%X&V&T'R'P'N'K'K)L+M,M.M1N3N5N7N9N;N=N?NANCNENGNINLNNNPNRNTNVNXNZN]N_NaNcNfNhNjNlNnNpOrOtOvOxPzP|P~P|"],
"u",
["#&#)#,#/#2#5#8#;#>#A#D#G#J#M#P#R$U%X&[(^)a*d,f-i/k0n2p5q7r:s=s@sCsFsIsLsNqPpSnTkViXfYdZa]_^[`XaVaSbPcMdJdGdDdAd?d<d9d6d3d0d-d*d'd$d d$d'd*d-d0d3d6d9d<d?eAfDfGfJfMfPgSgVgYg]h_ibjekhljnmopprrutwvyx{z}|~"],
"v",
["% &#&%(')(**+,,.-0-2.4/507192;3=3?4A5C5E6G7I8K9L:N;P<R=T>V?W@YA[A^B`CbCdDfEhFjGkGnHoIqIsIuJwKyL{M}M}M{NyNwOuPsQqRoSmSkTjUhUfUdUaV_V]WZXXYWZU[S]Q^O_N`L`JaHbFcDdBe@g?h=i;i9j8k6l4m2o1p/q-r+s*t(u&w&x$y#z!"],
"w",
[" ,#-$0%3&5'8';)=*@+C,E-H-K-M.P.S.V/Y0[1_2b2d4g4j5l5o6r8r:p;m<k=h>e>b@`A]BZCWCTDQEOELFIGFGDGAIAJCLEMHOJPMQORRSUTWUZW]X`Zb[e]g^j`laocqesfvfwftgrhoilijjgkdkal^m[nXoVoSpPpMqJrHsEsBt?u=v:w8x5z3z0{-}+}(~)~,"],
"x",
["5%7':);,>.@1B3E5G8J:L<N?QASDUFVIYK[N^P`SbUdXf[g_iajejhjkinhrgufxcz`{]|Y}V}S}PzNxMuKrKnKkKhJeJaJ^KZLVLSNPOMPJQGSDTAU>W;Y9[6]3_0`-b*d(e%h#h!f%c'b*`-_0]3[6Z9X<W?VBTERHPJOMMPLSJVIZH]F`EdDgCjBm@p?s>v=y<|<~"],
"y",
["A B#B%B(B*B,B/B1B3B5B8B:C<C?DADCEEEHFJHKILLMNMPMRLULVJXIYGZE[C[@]>^<_:`8`6`3`1`/`,`*a(a&`$`&`)`+a-a0a2a4a6a9a;a=a@aBaDaFaIaKaMaPaRaTaWaYa[a^aaac`e`h`j`l`n`q_s^u]w[yYzX|V}S}Q}O~M~K~H~F}E{DyCwBuAs@q>p@p"],
"z",
["&')),*.,1,4-7/:/=0@0D0G0J0M0Q0T/W/Z.^-a,d+g*j*m(o'r&u&x%{$~#{%x'w)t+r-o/l1j3h5e7c9a<_>[@XAUCSEQGNJLLJNHQFSDVBX@[>^<a9c6e4f1i0k-n,q*s'u%x#y {$z'z)w,v/u1s4s7s9r<r@rCrFrIrMrPrSrVrZr^rardrfsitluowrxtyvzx|",],
"del",
["~Q}P}P|P{PzPyPxPwPvPuPtPsPrPqPpPoOoOnOmOlOkOjNiNhNgNfNeMdMcMcMbMaM`M_M^M]M[MZMYMXMWMVMUMTMSMSNRNQNPNONNNMNLNKOJOIOHOGOFOEOEODOCOBOAP@P?P>P=P<P;P:P9P8P7P7P6Q5Q4Q3Q2Q1Q0Q/Q.Q-Q,Q+Q*Q)Q)Q(Q'Q&Q%Q$Q#Q!Q Q"],
"spc",
[" T!T#T$T%T&T'T(T)T*T+T+T,T-T.T/T0T1T2T3T4T5T6T7T8T9S:S;S<S=S>S>S?S@SASBSCSDSESFRGRHRIRJRKRLRMRMQNQOQPQQPRPSPTOUOVOWOXOXOYOZN[N]N^N_N`NaNbNcNdMeMfMgMhMiMjMjLkLlLmLnLoKpKqKrKsKtKuKvKwJwJxJyJzJ{J|J}J~J~K"],
L_ARROW,
["~g|g{gygxgvgugsgqgpgngmgkfjfhfgeeedebdad_d]d[dYdXcVcUcScRcPcNcMcKcJcHbGbEbDbBb@b?b=a<a:a9a7a6a4`3`1`/`.`,`+`)_(_&_%_#_!_!_#^%]&['Z(Z*Y+X,W.V/U0T2T3S4R6Q7P8O9N;M<L=K>J@JAIBGCFDEEDFCHBIAI@K?L>M=N;N:O9Q8"],
R_ARROW,
[" a#a$a&a'a)a*a,a-a/a0a2a3a5a6a8a9a;a<a>a@aAaCaDaFaGaIaJaLaMaOaPaRaSaUaVaXaYa[a^a_aaabadaeagahajakamanap`q`s`t`v`w`y`z`|`}`~_|^{^z]yZxYwYuXtWsVqUpToTnSlRkQjPiOgNfNeMdLcKaJ`I_I]H[GZFXFWEVDUCSBRAQ@P?O>M>"],
"1",
["B>B@C?D>E=E<F;G:H9I8I7J6K5L4L2M1N0N/O.O-P+P*Q)Q(Q&R%R$S#T U U!U$U%U&U(U)V*V+V-V.V/V1V2V3W5W6W7W9W:W;W=W>W?WAXBXCXEXFXGXHXJXKXLXNXOXPXRXSYTYVYWYXYZY[Z]Z_Z`ZaZb[d[e[f[h[i[j[l[m[n[p[q[r[t[u[v[x]y]z]{]}]~"],
"2",
["42516/7-8,:*;)<'>&@%A%C$E#G#I!K!M!O Q S!T#V$W&X'Y)Z+[,[.]0]2]4[6Z7Y9W;V<U>T?RAQBPDOFNHMILJJLIMGNFPDQBRAR?T>U=W<Y;Z:]:_9a9c9e9g9i9k9m9o9q9s:u:w:x;z;|<}>|?{AzCzEyGyIyKyMyOzQzSzUzWzYz[{^{_|a|c|e|g|i}j}j}"],
"3",
["7!8 ; = ? A!C!E#G#J#L#N#P#R#T#W#Y#[#^#`#b#c$a&`'_)]+[-Z.Y0X2W4U6T7S9R;Q=P?OANCMELGKHJJMJOJQJSJUJWJYK[L^M`NbOcQeRfTgVhXiYj]k_kakckelglilkknkpjrhsgufwdxcya{_|]|Z}X}U}S~Q~O~M~K~I~F~D}B|@{?z=y;x:v8u7s5r3p"],
"4",
["xKvKsLqLoLlLjLgLeLbL`L]LZLWLULRLPLNMKMINFNDOAO?O=O:O8O5P3P0P.P+P)P'Q)P+N-M.K0I2G4F6D8C:B<A>@@>B<D;F9H7J6K4M2O1P/R-S+T)V&W$X!Y!Y$Y'Y)Y,Z.Z1Z3Z6Z8Z;Z=Z?ZBZDZGZIZLZNZQZSZVZXZ[Z^Z`ZcZeZhZjZmZoZrZt[w[y[|[~"],
"5",
["h'f(d)b*_*]+Z+X+U+S+Q*O)M)K(H'F&D%B$@#>!<!9!7 7#7%7'7*7,7.808385878:8<8>8@8C8E8G8I8L8N9P9R;R=Q@QBPDOFNHNJMMMOLQLSLULXMYN[P^Q`SaUbWcYd[d^e`ebfegggigkgngpgrftevdxcza{_}]}Z~X~U~S~Q}O|M|J|H{F{DzBy?x=w;v9v"],
"6",
["c d b ` ^!Z#X$V%T&R'P(N)L*J+I,G.E/C1B2A4@6?8?;>==?<A<C<E;G;J:L:N:P9R9U9W9Y9[9_9a9c9e9h9j:l;n<p>q?s@uBwCxEzG{I|J}M~O~Q~S~V~W}Y{[z^y_wavbtcrepfnflfjfhfeddcbb``^_]]Z[XXXVWTWRXPXMXKXIXGXDXBY@Z?[=^<`;a9c9b"],
"7",
["0)0+2+3,5,7,8,:,<,=,?,A+B+D+F*G)I)J)L)N(O(Q(S'T'V&X&Y&[%]%_%a$b$d$f$g$i#j#l!m o n!m$l%k&j(i)h+h,g.f/e1d2d4c5b7a8`:`;_<^>]@]A[CZDZFYGXIXJWLVMVOUQURTTTUSWSYRZR]Q^P`PbOcOeNfNhMjMkLmLnLpLrLtLuKwKxJzJ|I}J~"],
"8",
["g(d'b&_%[$X$T$Q#N#K#H!E!B ? =#;%9'7*6-5/4245486;8=;?=@@BCCEEHGJHMIPISJVKYK]L`McNeQfSgVhYi]i`icifiiilhogrfucway^zZ{X|U}R~O~L~I~E~B~?}=|<z<w<t=q>n@lBiCgEdGbI`J]LYMWNTPQQNQKRHTFVCXAZ?]<_:`7a4c2e/f-h*i'k%"],
"9",
["g)g(e'c&a%_$]#Z!W!U S P N K I G D!B#@$>&<';)9*8-7/616356586:7<8?9@;B=C?EAFCGEHHIJILIOHPGRFTDVBWAY?[=];_:`7a5c4d2e0f.h,j*h,g.f0e2c4b6a8_:^<[=Z?XAWCVFUHTJSLRNQPPSOUNWMYL[K^J`IbGdGgFiDkDmCoBrAt@v?x>z=|;~"],
"0",
["=O<P:R9U9W8Z7^6`6c6f6h6k6n7p8s:u<w>x@zB{E|H}J}M~P~R~T|W{Yz]x_waucsdqfoglijjhlflcm`n^oZpXqUqRqPqMpJoHnEmCl@k>j;i9h6f4e2c0a._,]*Z(X'V%T#Q!O L I G D B!?#>%<(;*:-9/827467595<4?4A4D3G2I2L1N0Q/S/V/Y.[._/b/a"],
"!",
["IeJdLcNcPbQbSbUbWbYb[c^c_d`ebfbhcjdkdmdocqcsat`v_w]x[yYzW{V{T|R}P~O~M~K~I~G~E~D}B|A{?z>x=w<u;t;r;p;n<l=k>i?hAgBeCdEdGcIcJcLcNcPcRbR`R_R]RZRXRVRTRRQPQNQMQKQIQGQEQCPAP?P>P<P:P8P6P4P2P1P/P-P+P)P'P%P#P P!"],
"@",
["]BXBUBQBMCJCFCBD@G@J@NAQBUDXE]G_J`N`Q^T[VXYU[S]O[M[Q[T[X][`_cagbkbnbq`t]vZxW{T}Q}M~I~F}B|?z<x9u6r4o3k1h/e.a,^+Y*V)R(N(K(G(C(@(<)9*5,2-//,1)3&6$9!<!@ C G!J#N%Q'T)W+[-_/b1e3h6j:l=m@nDoHpKpOqRrVsYt^ubvew"],
"#",
["FuEoGiGcH]IVJPKKLEM?N9O3P-Q'R)R/R5R;RARGSMTSUYV`VfVlWqWwXwYq[l[f^`_Y`SaMcGcAd<e6f0h+d._0Y3S6N9J=E@?C9E4F.H(J!J&J,K2L8M>NCPIPOPVP]PcPiQnQtRzS}TwVqWkXeZ_ZX[R]L_FaAb;c5d/e)e#f)f/h5i;k@mFnLoRpXp_qerksqtuv"],
"$",
["i?g?d?`>]>X>U=R=N<K<G<D=@==>:@7A4C4F5I8L9O;R>SBSETITLTPTSTVTZU^VaXdYgZj]k`jdgfdgah^hYiVjSjOkLkHkEkBl>l=j=g>c?`@]@XAUAQBNBKCGCDD@D=E9F6G3H/I,J)K&L!M#M'M*M.M1M4M8M;M?MBMFMIMMMPMTMWM[M_NcNfNiNmNpNtNwO{P~"],
"%",
["++0*5*:,?.B2D7E<DAAE=G8I3I-J)G&C$>!9 4 /$+()-(2'7'='B'G'L'Q'V&]%b%g$l#q#v!{ |#y&v*q-m1j4f8b;_?ZBVERINLJPFSBW>Z;^7b4f1j.n+q.m2j5f9b=_B]FZKXPVUTZR`ReRjSoUrXu]vbwgwmuqsvpzl}g~b}]{XxSuQrPmPhQcT^XZ]YbYgYlZ"],
"^",
[" h!h$g%f&f'e(d)c*b,b-a.`/_0^1]2[3Z4Y5X6W7V8U9T:S;R<P<O=N>M?L@K@IAHBGBFCDDCEBFAG@G?H>I<I;J:K9L8M7N6O6P7Q8Q9R;S<T=U>V?W@XAYBZC[D]E^F_G`HaIbJcKdLeMfNfPgQgRiSjTkUlVmWnWoXpYq[r]s^t_u`vavbxcyczd{f{g|g}h~h~j"],
"&",
["hwexcwau_s^q[oYmWjVhTfScQaP_N]MYKWIUHRGPFMEKDHCFBCB@A=A;A8A5A2A/A-C+C(D%F#H K M O#P&Q(R+R.S0S3T6T9T;T>SARCRFQIOKNMMPKRJTHWGYF]D_BaBdAf?h>k<m:o8q7s7v7y7|8~;~=~@~C}E|GzIxKwMtNrPpRnTlVjWhXfZc]a__`]bYdWeV"],
"*",
["RLRHRCR>R9P4P/P*P%P!P'O+N0N5N:N?NDKFFFBC=A9?4=0;-80:3=7A:D=H@LDOGRHTDXA[=`:c7g5l2p/t+w({,{0w4t7p:l;h>cA_CZEVIRLPNSRWU[W`Zd^haldpgskwnzr}p{mwitfpcl`h]dZ`W[SXUUXQ]NaKeHhDlAp>s;w8u9q;m>iAeDaG]JXMTPPRKTGW"],
"(",
["U T!S#S$R$R%Q&Q'P(P)O*O+N+N,M-M.M/L0L1K2K3K4J5J6J7J8I9I:H;H<H=G>G?G@GAGBFCFDFEEFEGEGEIEJEKELEMENEOEPEQERESETEUEVEWEXEYFZF[F]G^G_G`HaHbIcIcIdJeKfKgLhLiLjMkMlNmNnOnOoPpPqQrQsRtRuSvSvTwTxUyVzV{W{W|X}Y~Y~"],
")",
["E F G!G#H#I$J%J&K&L'L(M)M*N*O+O,P-P.Q/Q0R1R2S3S3T4T5U6U7V8V9V:W;W<X=X>X?X@XAXBYCYDYEYFYGYHYIYJYKYLYMYNYOYPYQYRYSYTYUYWYXYYYZX[X[X]W^W_V`VaVbUcUdTeTfSgShSiRjRkQlQmPmPnOoOpNqNrNsMtMuLvLwLxKyKzJ{J{I|I}H~"],
"cap",
["Q~Q}Q|Q{QzQyQxQwQvQvQuQtQsQrQqQpQoQnQmQlQkQjQiQhQgPgPfPePdPcPbPaP`P_P^P]P[PZPYPXPWPVPVPUPTPSPRPQPPPOPNPMPLOKOJOIOHOGOGOFOEODOCNBNAN@N?N>N=N<N;M:M:M9M8M7M6M5M4M3M2M1M0M/M.M-M,M+M*M*M)M(M'M&M%M$M#M!M N "],
"ret",
["}/~0|1{2z3x3w4u5t5r6q6p7n7l7k7i7h7f7e7c7b7`7_7]7Z7Y7W7V7T8S8Q8P8N9M9K9J9H9G9E9C9B9@9?9=9<9:9997969492919/9.9,9+9)9(9&9%9#9!8 9 : < = ? @!B!C!E#F#H#I#K$L$N$O%Q%S%T%V%W&Y&Z&]&^&`'a'c'd'f'g'i(j(l(m(o(o(n"],
"-",
[" Q#P$P&P(P*P,P.P/P1P3P5P7P8P:P<P>P@PBPCPEPGPIPKPMPNPPPRPTPVPWPYP[P^P`PbPcPePgPiPkPmPnPpOrNsNuMwMyM{M|M~L|L{LyLwLuLsLqLpLnLlLjLhLgMeMcMaM_M]M[MYMWMUMSMQMPMNNLNJNINGNENCNAN@N>O<P:P8P7P5P3Q2Q0Q.Q,Q*Q*R(R"],
"_",
["~P|PzPxQwQuRsRqRoRmRkRiRgRfRdRbR`R^R[RYRWRURSRQRPRNQLQJQHQFQDQBP@P>P=P;P9P7O5O3O1O/N-N+N*N(N&M$M!M!M$M%M'M)M+N-N/N1N3N5O6O8O:O<O>O@OBODOFOHOJOLONOOOQOSNUNWNYN[N^N`NbMcMeMgMiMkMmMoMqMsMuMvLwLyL{L}L~M~O"],
"=",
["#`&`)_+_.^1]4]6[9[<[?ZBZDYGYJYMXPXRXUXXW[W^WaVdVgViVlVoVqWtXwXyY|Y{YxYvXsXpWmVkUhUeUbT`T]TYSVRTRQQNPKOINFMDLAL>K<J9I6G4F1F/E,D)D'B$B!A#A&A(@+@.@1@4@7@9@<@?@B@E@H@J@M@P@S@V@Y@[@_@b@e@h@k@m@p@s@u?x?{?~?"],
"+",
["F$H!H#H%H(I*I-I/I2I4I7I:J<J?JAJDJFJIKKKNLPLSLULXLZM^M`McMeNgNjOlPoPqPtQvQyQ{Q~P|NzMxKwIuGsFqDoCmAk?i=h;f:d8b6`4_2]1Z/Y-W+U)T&S%R#P%P(P*P-P/P2P4P7P:P<P?PAPDPFPIPKPNPPPSPUPXP[P^PaPcPfOhOkOmOpOrOtNwNyN|N"],
"{",
["Z!Y W U T R!Q!O#M#L#J$I%H&F'E)E*D,D-D/D1D2D4D6E7F9G9I:J:L;M;O<P=R>S?T@UAVCWDXFXGXIWKVLUMSMROQPOQNQLQJQIQGQEQDQFQGQIQKQLQNQOSQSRUSVTWUXUZV]V^V`UaTbRcQcPdNeMeLfJgJhHjGkGmGnGpGrGsHuIvJwKxLyNzO{Q|R}T}U~V}"],
"[",
["c~a~_~^~[~Y}X}V}U}S}Q}P}N}L}K|I|G|F|D|B|A|?|=|<{<z<x<v<u<s<q<p<n<l<k<i<g<f<d<b<a<_<]<[<Y<W<V<T<R<Q<O<M<L<J<H<G<E<C<B=@=>===;=9=8=6=4=3=1=/=.>,>+>)>'>&?$@$B$D$E$G$I$J$L$N$O$Q$S$T$V$X$Y$[$^$_$a$c$b#a!` "],
"}",
["B!D F G I K!M!N!P#Q$S%T&U'W)W*X,X.X/X1X3W4W6V8T8S9R:P;O<M=L>K?JAIBHDHEHGHIIJJKKMLNNOOPPQRQTQVQXQYQ[R]R[RYSWSVSTSRTPTOTMULVLXLYL[L^L`MaMcOdPeQgSgThViWjYkZl[m[o[q[s[tZvYwXyWzV|U}S}R~P~N~L~K}I}G}F|D|B|A|"],
"]",
["=~=|?|@|B|D|F|G}I}K}L}N}P}R}S~U~W~X~Z~]~_~`~b~c}c{cycxcvctcscqcocmclcjchcfcecccac`c^c[cYcXcVcTcRcQcOcMcKcJcHcFcEcCcAc?c>c<c:c8c7c5c3c1c0c.d-d+d)d(d&d$d!c b ` ^!]!Z!X!V#U#S#Q#P#N#L#J#I#G#E#C#B#@#>#<#;!"],
"|",
["M#M N!N$N&M(M)M+M-M/M1M3M5M7M9M;M=N>N@NBNDOFOHOJOLONOPOQOSOUOWOYP[P^P`PbPdPfPgPiPkPmQoQqQsQuQwQyQzQ|R~R|RzRxRvRtRsRqRoRmRkRiRgReRcRaQ`Q^Q[QYQWPUPSPQPOPMOLOJOHOFODNBN@N>N<N;M9M7M5M3M1M/L-L+L*L(L&L$L!L$"],
"\\",
[" $!$#%$&%'&(')(*)+*,+-,.-.-/.0/102132435465758697:8;9<:=;><?=@=A>B?C@CADBECFDGEHFIGJHKILJLKMLNMONPOQPRQSRSRTSUTVUWVXWYXZY[Z][^]^^__`_aabbbccddeeeffgghhiijjkklllmmnnoopppqrqrrssttutwuwvxvywzx{y}y}{~{~z"],
"'",
["3~4}4|5{6{8{9{:z:y;y<x=w>w?v@vAuBtCtDsErFqGpGoHoInJmKlLkLjMjNiOhPhQgRgTfTeUeVdWcXbYaY`Z_[_]^]]][]Y^Y_X`WaVaUbTbScRcQcPcNcMcLcKdJdIeHeGfEfDgCgBhAh@i?i>i=i<j;j9k8k7l6l5l4l3l2l0l/l.l-l,l*l)l(l'l&l%l#l!l "],
"<",
["}3{3y3w3v4t5r6p6n7m8k9i:g;e;d<b=`=^>[>Y?W?U?T@R@PANBLCKDIEGFEFCGBH@I>J<J:K9L7M5N4O2P0P.Q,Q*R(S&S%T$U!U V#W%W'X)X+Y-Y/Y1Z3Z5[6[8[:]<]>^@^B_D`F`GaIaKbMbOcQcSdUdWeYe[e]f_fagcgehghiikjmjojpjrktkvkxkzl|l~l",],
">",
["%:':):+;-;/;1<3<4<6=8>:>;?=??@AACAEAFBHBJCLDMDOEQESFUFWGXGZG]H_HaHcIdJfKhKjKlKmLoLqMsMuMwMyNzO|O~O|OzOyOwOuOsPqPoPmPkQjQhRfReScTaU_U]U[VYVWVUVSVQVOVMVLWJWHXFXEYCZA[@]>]<^:^8_7_5`3`1`/`.a,b*b(c&c%d#e e",],
",",
["b b!b#b$b%b&b'b(b*b+b,b-b.b/b0b1b2b3b4b5b6b7b9b:b;b<b=b>a?a@aAaBaC`D`E`F_G_H_I^J^K^L]M]N]O[P[QZRZSYTYUXVXWWXWYVZV[U]U^T_T`TaSaRbRcQdPePfOgOgNhMiMjLkLlKmJmInHnHoHpGqFqErEsDtCtBuBvAwAxAy@z?{?{?}>}>}?~@~"],
".",
["J N Q T W [ _ b e h#k$n&p(r)t,u/w1x4z7{:{={@}C}F~I~L~O~R~V~Y~]~`~c}f{hykwnvpssqtnukvhweyb{_{[{X}U}R~O~L~I~F~B~?~<~9~6|3{0z.x+w)u(r'p%n%k$h$e!b!_ [ X U R O K H E!B#?%=&;(:)7+4,2/20/3.5-8-;,>+A*D*G*H'J%"],
"/",
["n!n n!m#m$l%k&k&j'i(i)h*g+g,f-e.e/d0d1c2c3b4a5a6`7`8_9^:^:];]<[=[>Z?Y@YAXBXCWDWEVFVGUHTITJSKRLRMQNPOPPOQORNRMSMTLUKVKWJXIYIZH[G]G^F_E`E`DaCbCcBdAeAf@g?h?i>j=k=l<m<m;n:o:p9q8r8s7t6u6v5w5x4y3z3z2{2|1}1~"],
"?",
["3,5,7+8*9);(<'='?&@%B%C$E$G$H#J#K#M!O!P!R T U W Y Z ] ^!`!b#c#e$f%g'h(i)i+j,j.k/l1l2l4l6k7k9k:k<j>j?iAiBhDgEfFeHcIbJaK`L^M]N[OYPXQWRWTUUTURVQXPYOZN[M]M_M`LbLcKeKfJhJiJkJmJnJpJrJsIuIvIxJyK{L|M}N}P~Q~Q|"],
"face()",
["`0^0Z0X0U0R0P/M/K/H/E/C/@0>0;19263442607.9,;*=)?'A%C$E#G!J L O Q T W!Y#[%^'`)a+c-d0e2f5h7i9j<k>lAlCmFnHnKoMoPpSpUpXpZp^papcofohnkmmkojqhsguewdyb{`|^}Z}X~U~R~P~M}K|IzGxDwBv@t>r<q:o8m7j6h5e4c4`4^3Z3X3U3",":V:V;V;V<V<V<V=V=V>V>V?V?V?V@W@WAWAWAWBWBWCWCWCXDXDXEXEXEXFXFXGYGYGYHYHYIYIYIYJYJYKYKYKYLZLZMZMZMZNZNZOZOZPZPZPZQZQZRZRZRZSZSZTZTZUZUZUZVZVZWZWZWZXZXZYZYZZZZZZZ[Z[Z]Y]Y]Y^Y^Y^Y_X_X_X`W`W`WaWaWaVbVbVbU","9C9C9C9C9C9C9B8B8B8B8B8B8B8B8B9B9B9B9B9B9B9B:B:B:B:B:B:B:B:B;B;A;A;A;A;A;A;A;A;A<A<A<@<@<@<@<@<@<@=@=@=@=@=@=@=@=?>?>?>?>?>?>?>?>?????????????????@?@?@?@?@?@?@?A?A?A?A?A?A?A?B?B?B?B?B?B?B?B?C?C?C?C?C?","Y<Y<Y<Y<Y<Y<Z<Z<Z<Z<Z<Z<Z<Z<Z<[<[<[<[<[<[<[<[<]<]<]<]<]<]<]<]<]<^<^<^<^<^<^<^<^<_<_<_<_<_<_<_<_<_=_=`=`=`=`=`=`=`=`=`=`=a=a=a=a=a=a=a=a=a=b=b=b>b>b>b>b>b>b>b>b>b>b>b>b?b?b?b?c?c?c?c?c?c?c@c@c@c@c@c@c@",],
"kwa()",
["K H E C @!>#<%:&8(5*3+1-0/.1-4,6+9*;*>)@)C(F(H'K'N'P'S(U)X*Z,]._/b1d3e5g7h:i<j?kBlDlGmImLnOnQoToWoYo]n_mbldkgjiilinhqfseucvax_y]zY{W|T}R}O~L~J~G~D}B}?{=z:y8x6v3u1s/q.o,m*k(i'g%d$b#_!]!Y V T Q N L I!F!","B!A!@!@!?!?!>!=!=!<!<!;!:!:!9!9 8 7 7 6 5 5 4 4 3 2 2 1 1!0!/!/!.!.!-#-#,#,$+$+$*%)%)%(%(&(&''''&(&(&)%)%*%*$+$+$,#,#-#-!.!.!/ / 0 1 1 2 2 3 4 4 5 6 6 7 7 8 9 9!9!:!;!;#<#<#=#=$>$>$?%?%@%@%A&A&A'B'B'C","W*V*T*S*Q*P*N*M*K*J*H*G*E*D*B+A,@-@.?/?1?2>4=5<6<7;9;:;<;=;?:@:B:C:E:F:H;I;J<L=M>N?O@PBQCQDRFSGSHSJSKSMSNSPSQRSRTRVQWQYQZP]P^O_O`MaLbKdJdIeHfFfEfCgBhAh?i>j=k;k:k8k7j5j4i3h1h0g/e.d-c-a-`,_+]+[*Z*X*W*V)","ImImInInInInInInInInIoIoIoIoIoIoIoIoIpIpIpIpIpIpIpIpIqIqIqHqHqHqHqHqHqHqHqHrHrHrHrHrHrGrGrGsGsGsGsGsGsGsGsGsGsGtGtFtFtFtFtFtFtFtFtFuFuFuFuFuFuFuFuFvFvFvFvFvFvFvFvFvEwEwEwEwEwEwEwEwEwExExExExExExExExEx","dldldldmdmdmdmdmdndndndndodododododpdpdpdpdpdqdqdqdqdqdrdrdrdrdsdsdsdsdsdtdtdtdtdtdudueueueuevevevevevewewewewewexexexexexeyfyfyfyfyfzfzfzfzfzgzg{g{g{g{g{g{g{h|h|h|h|h|h|h|h|i}i}i}i}i}i}i}j~j~j~j~i~i~",],
"mit()",
["!f!d!c!a!`!^!]!Z!X!W!U!T!R!Q!O!N!L!K!I!H!F!E!C!B!@!?!= < ; 9 8 7!8#9#:%;%<&='>(?)@*A+C-C.D.F0G1H2I3J3I4H5G6F6E7C7B8A:A:?;><==<=;>9>8?8@7@8@:@;@=@?@@@B@C@E@F@H@I@K@L@N@O@Q@R@T@U@W@X@Z@[@^@_@a@bAdAeAfAh","E7E7E7F7F7F7F7G7G7G7G7G7H7H7H7H7I7I7I7I7I7J7J7J7J7J7K7K7K7K7L7L7L7L7L7M7M7M7M7N7N7N7N7N7O7O7O7O7P7P7P7P7P7Q7Q7Q7Q7R7R7R7R7R7S7S7S7S7T7T7T7T7T7U7U7U7U7V7V7V7V7V7W7W7W7W7W7X7X7X7X7Y7Y7Y7Y7Y7Z7Z7Z7Z7[7[7","EfEfEfFfFfFfFfFfGfGfGfGfHfHfHfHfHfIfIfIfIfJfJfJfJfJfKfKfKfKfKfLfLfLfLfMfMfMfMfMfNfNfNfNfOfOfOfOfOfPfPfPfPfPfPfPfQfQfQfQfQfRfRfRfRfRfSfSfSfSfTfTfTfTfTfUfUfUfUfVfVfVfVfVfWfWeWeWeWeWeXeXeXeXeYeYeYeYeYeZe","O7O8O8O9O9O9O:O:O;O;O<O<O=O=O>O>O?O?O@O@OAOAOBOBOCOCOCODODPEPEPFPFPGPGPHPHPIPIPJPJPKPKPKPLPLPMPMPNPNPOPOPPPPPQPQPRPRPSPSPSPTQTQUQUQVQVQWQWQXQXQYQYQZQZQ[Q[Q]Q]Q]Q^Q^Q_Q_Q`Q`QaQaQbQbQcQcQdQdQePePePfPfPg","_7`7`7`7a7a7a7b7b7b7b7c7c7c7d7d7d7e7e7e7f7f7f7f7g7g7g7h7h7h7i7i7i7j7j7j7j7k7k7k7l7l7l7m7m7m7n7n7n7o7o7o7o7p7p7p7q7q7q7r7r7r7s7s7s7s7t7t7t7u7u7u7v7v7v7w7w7w7w7x7x7x7y7y7y7z7z7z7{7{7{7|7|7|7|7}7}7}7~7~7","o8o9o9o:o:o;o;o<o<o=o=o>o>o?o?o@o@oAoAoAoBoBoCoCoDoDoEoEoFoFoGoGoHoHoIoIoJoJoKoKoLoLoMoMoNoNoOoOoOoPoPoQoQoRoRoSoSoToToUoUoVoVoWoWoXoXoYoYoZoZo[o[o]n]n]n^m^m^m_m_m`m`mamambmbmcmcmdmdmememfmfmgmgmhmhmh",],
"clear()",
["}NzNxNuNrNoNlNjMgMdMaM_M[MXMUMRMPMMMJMGMDMBN?N<N9N6N4N1N.N+O)O&O#O P$P'P)P,Q/Q2Q5Q7Q:Q=Q@QCQEQHQKQNQQQSQVQYQ]Q`QbQeQhPkPmOpOsNvNyN{N~N{NyMvMsMpMnMkMhMeMbM`M]MYMVMSMPMNMKMHMEMBM@M=M:M7M4M2M/N,N*N'N%O!O",],
"kbd()",
["Q}Q{QyQxQvQtQrQpQnQlQjQhQgQeQcQaQ_Q]QZQXQWPUPSPQPOPMPKPIPHPFPDPBP@P>P<P:P8P7P5P3P1P/P-O,O*O(N&N%N#N N#N%N'N)N+N,N.N0N2N4M6M8M9M;M=M?MAMCMEMGMIMJMLMNMPMRMTMVMXMZM[M^M`NbNdNfOgOiOkPlPnPpPrPtPvPxPzP{P}O}",],
];

var glyphs = [];
for (var i = 0 ; i < glyphData.length ; i += 2)
   registerGlyph(glyphData[i], glyphData[i+1]);


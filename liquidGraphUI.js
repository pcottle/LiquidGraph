
/*****************CLASSES*******************/

function uiControl(parentObj) {
    this.active = false;
    this.UIbutton = null;
    this.parentObj = parentObj;

    //we have to bind the "this" scope to our object for the
    //event handlers
    var cc = function(e) {
        this.canvasClick(e);
    };
    var cm = function(e) {
        this.canvasMove(e);
    };
    var crc = function(e) {
        this.canvasRightClick(e);
    };
    var mu = function(e) {
        this.canvasMouseUp(e);
    };
    var kd = function(e) {
        this.canvasKeyDown(e);
    };

    try {
    crc = crc.bind(this);
    } catch (e) { 
        alert("Sorry, Your browser does not support javascript function context binding! Hence this only works in Firefox / Chrome :D");
    }

    cc = cc.bind(this);
    cm = cm.bind(this);
    mu = mu.bind(this);
    kd = kd.bind(this);

    //register event handlers
    $j('#canvasHolder').bind('mousedown',cc);
    $j('#canvasHolder').bind('mousemove',cm);
    $j('#canvasHolder').bind('contextmenu',crc);
    $j('#canvasHolder').bind('mouseup',mu);
    $j(document).bind('keydown',kd);
}

uiControl.prototype.canvasKeyDown = function(e) {
    if(this.parentObj.active)
    {
        var which = e.which;
        this.parentObj.keyDown(which,e);
    }
}

uiControl.prototype.canvasRightClick = function(e) {
    if(this.parentObj.active)
    {
        e.preventDefault();
    }
}

uiControl.prototype.canvasMouseUp = function(e) {
    if(this.parentObj.active)
    {
        this.parentObj.mouseUp(e.offsetX,e.offsetY);
    }
}

uiControl.prototype.canvasMove = function(e) {
    if(this.parentObj.active)
    {
        var x = e.offsetX; var y = e.offsetY;
        if(!x) { x = e.pageX; y = e.pageY; } //FF

        this.parentObj.mouseMove(x,y,e);
    }
}

uiControl.prototype.canvasClick = function(e) {

    if(!this.parentObj.active)
    {
        return;
    }

    var x = e.offsetX;
    var y = e.offsetY;

    if(!x) //FF
    {
        x = e.pageX;
        y = e.pageY;
    }

    if(e.which == 1)
    {
        this.parentObj.leftClick(x,y);
    }
    else
    {
        this.parentObj.rightClick(x,y);
    }
}

//stubs
uiControl.prototype.mouseUp = function(x,y) {
    return;
}

uiControl.prototype.rightClick = function(x,y) {
    return;
}

uiControl.prototype.mouseMove = function(x,y) {
    return;
}

uiControl.prototype.leftClick = function(x,y) {
    return;
}

uiControl.prototype.keyDown = function(which) {
    return;
}

function UIButton(parentObj,id,text,activeText,buttonsToShow) {

    this.active = false;
    this.parentObj = parentObj;

    this.text = text;
    this.activeText = activeText;
    this.id = id;

    if(buttonsToShow) {
        var buttons = buttonsToShow.map(function(id) { return "#" + id; });
        this.buttonsToShow = buttons.join(',');
    } else {
        this.buttonsToShow = "";
    }

    this.mainButtons = ['addPolyButton','traceButton','editPolyButton'];
    this.mainButtons = this.mainButtons.map(function(id) { return "#" + id; });
    this.mainButtons = this.mainButtons.join(",");

    var cHandler = function(e) {
        this.anchorClick();
    };
    cHandler = cHandler.bind(this);

    $j('#' + this.id).click(cHandler);
}

UIButton.prototype.anchorClick = function() {

    var nots = ":not(#" + this.id + ")";

    if(!this.active)
    {
        this.parentObj.activate();
        $j('#' + this.id).text(this.activeText);

        $j('.uiButton').filter(nots).slideUp();

        $j(this.buttonsToShow).slideDown();
    }
    else
    {
        this.parentObj.deactivate();
        $j('#' + this.id).text(this.text);

        $j(this.buttonsToShow).slideUp();
        $j(this.mainButtons).filter(nots).slideDown();
    }
}


function rArrow(pos,vel) {
    if(!pos || !vel) { throw new Error("null arguments!"); }
    //ok so we want to essentially make a path that looks like an arrow

    //this consists of making a path. first we start at our position, and then
    //we move some fraction of our velocity in the velocity direction to get our second point.

    //then we draw the arrow heads. this is done by doing some vector rotations and the like
    this.pos = pos;
    this.vel = vel;

    this.path = null;

    this.buildPath();
}

rArrow.prototype.buildPath = function() {
    //ok get the first point, that's easy
    var points = [];

    var tail = this.pos;
    points.push(tail);

    //now get the head
    var fraction = 0.5;

    var velScaled = vecScale(this.vel,fraction); 
    var head = vecAdd(velScaled,tail);
    points.push(head);

    //ok so we need to do something simple. first get the angle from the head to the tail
    //aka, the atan2 of the negated velocity
    var fromHeadToTail = vecNegate(this.vel);

    var angle = vecAtan2(fromHeadToTail);

    //now add 45 to get chevron1 (i know these aren't chevrons but i dont have a good name
    //for the little dangly things off the arrow head).
    //and subtract 45 to get chevron2

    var chev1Angle = angle + Math.PI * 0.25;
    var chev2Angle = angle - Math.PI * 0.25;

    //get these vectors
    var chev1Vec = vecScale(angleToVec(chev1Angle),vecLength(this.vel) * 0.1);
    var chev2Vec = vecScale(angleToVec(chev2Angle),vecLength(this.vel) * 0.1);

    //get these points
    var chev1point = vecAdd(head,chev1Vec);
    var chev2point = vecAdd(head,chev2Vec);

    points.push(chev1point,head,chev2point,head);

    //now the path. god this is a long process
    var pathStr = constructPathStringFromCoords(points);

    var velMag = vecLength(this.vel);

    var extra = map(velMag,0,1000,0,10);
    var strokeWidth = 2 + Math.round(extra);

    this.path = p.path(pathStr);
    this.path.attr({
        'stroke-width':strokeWidth,
        'stroke':velocityHue(this.vel),
         'stroke-linecap':'round',
        'stroke-linejoin':'round'
    });
}

rArrow.prototype.update = function(pos,vel) {
    if(this.path)
    {
        this.path.remove();
    }

    this.pos = pos;
    this.vel = vel;

    this.buildPath();
}

rArrow.prototype.remove = function() {
    if(this.path)
    {
        this.path.remove();
    }
}

rArrow.prototype.highlight = function() {
    if(this.path)
    {
        this.path.attr({
            'stroke':'#F00',
            'stroke-width':5
        });
    }
}






/*^^^^^ general UI classes ^^^^*/
/*

 *->    specific UI classes <- */


function polygonUIControl() {

    this.uiPoints = [];
    this.uiPath = null;
    this.currentPoint = null;
    this.firstTime = true;
    this.active = false;

    this.prototype = new uiControl(this);
    this.UIbutton = new UIButton(this,'addPolyButton','Add Polygon','Stop Adding Polygons');
}

polygonUIControl.prototype.deactivate = function() {
    //remove our path and points from the screen
    $j.each(this.uiPoints,function(index,point) {
        point.remove();
    });

    if(this.uiPath) { this.uiPath.remove(); }
    if(this.currentPoint) { this.currentPoint.remove(); }

    this.active = false;
    //set our button as well
    this.UIbutton.active = false;
    $j('#canvasHolder').css('cursor','default');
}

polygonUIControl.prototype.activate = function() {
    //just reset some variables
    this.uiPoints = [];
    this.currentPoint = null;
    this.uiPath = null;

    if(this.firstTime)
    {
        //explain what to do if its our first time
        topNotifyTemp("Left Click to Add, Right Click / Space to close",5000);
        this.firstTime = false;
    }

    this.active = true;
    this.UIbutton.active = true;
    $j('#canvasHolder').css('cursor','crosshair');
}

polygonUIControl.prototype.keyDown = function(which,e) {

    if(!this.currentPoint || which != 32)
    {
        //we aren't inserting, dont do anything. or hit wrong button
        return;
    }

    var x = this.currentPoint.attr('cx');
    var y = this.currentPoint.attr('cy');

    //if it's a space, then go close the polygon?
    this.rightClick(x,y);
}

polygonUIControl.prototype.rightClick = function(x,y) {

    //close the path basically and make a polygon with this
    var c = cuteSmallCircle(x,y);
    this.uiPoints.push(c);

    var aPathString = constructPathStringFromPoints(this.uiPoints,true);

    //to dump this
    var polyPath = cutePath(aPathString,true);

    try {
        var polygon = new Polygon(this.uiPoints,polyPath);

        //add it to our polyController
        polyController.add(polygon);

    } catch(e) {
        topNotifyTemp(String(e));

        //we have to color this polygon red and remove it
        polyPath.animate({'stroke':'#F00','stroke-width':20},800,'easeInOut');
        $j.each(this.uiPoints,function(i,point) { point.animate({'r':0,'stroke':'#F00'},800,'easeInOut'); });

        var temp = this.uiPoints;

        //remove it in 1000 ms
        setTimeout(function() { 
            polyPath.remove();
            for(var i = 0; i < temp.length; i++)
            {
                temp[i].remove();
            }
        }, 1000);
    }

    //dump the ui stuff
    this.resetUIVars();
}

polygonUIControl.prototype.resetUIVars = function() {
    this.uiPath.remove();
    this.currentPoint.remove();

    this.uiPoints = [];
    this.uiPath = null;
    this.currentPoint = null;
}

polygonUIControl.prototype.leftClick = function(x,y) {

    var c = cuteSmallCircle(x,y);

    if(this.uiPath)
    {
        this.uiPath.remove();
    }
    this.uiPoints.push(c);

    //do a move to restore the path so it doesn't flicker when we are clicking
    this.mouseMove(x,y);
}

polygonUIControl.prototype.mouseUp = function(x,y) {
    return;
}

polygonUIControl.prototype.mouseMove = function(x,y) {
    //only do this when there is already one point
    if(!this.uiPoints.length) { return; }

    if(this.currentPoint)
    {
        this.currentPoint.remove();
    }

    //make a point underneath the mouse
    this.currentPoint = cuteSmallCircle(x,y,true);

    //append this point to the current points we have created
    var pointsCopy = this.uiPoints.slice(0);
    pointsCopy.push(this.currentPoint);

    //construct a path from this and draw it
    var pathString = constructPathStringFromPoints(pointsCopy,true);

    if(this.uiPath) { this.uiPath.remove(); }
    this.uiPath = cutePath(pathString);
}


function EditUIControl() {
    //this might be pretty simple

    this.active = false;
    this.firstTime = true;
    
    this.prototype = new uiControl(this);
    this.UIbutton = new UIButton(this,'editPolyButton','Edit Polygons','Stop Editing Polygons');
}

EditUIControl.prototype.mouseMove = function() { return; }
EditUIControl.prototype.mouseUp = function() { return; }
EditUIControl.prototype.leftClick = function() { return; }
EditUIControl.prototype.keyDown = function() { return; }
EditUIControl.prototype.rightClick = function() { return; }

EditUIControl.prototype.activate = function() {
    if(this.firstTime)
    {
        topNotifyTemp("Drag polygons / individual vertices",3000);
        this.firstTime = false;
    }

    this.active = true;
    this.UIbutton.active = true;

    this.setCursor('move','pointer');
}

EditUIControl.prototype.deactivate = function() {
    this.active = false;
    this.UIbutton.active = false;

    this.setCursor('default','default');
}


EditUIControl.prototype.setCursor = function(pathType,pointType) {

    //go make all the polygon rPaths have the right cursor
    for(var i = 0; i < polyController.polys.length; i++)
    {
        var poly = polyController.polys[i];
        var path = poly.rPath;
        var vertices = poly.vertices;

        $j(path.node).css('cursor',pathType);

        for(var j = 0; j < vertices.length; j++)
        {
            //$j(vertices[j].rPoint.node).css('cursor',pointType);
        }
    }

}


function TraceUIControl() {
    this.resetVars();
    this.accel = {'x':0.5,'y':50};
    this.firstTime = true;

    this.prototype = new uiControl(this);
    this.UIbutton = new UIButton(this,'traceButton',
                'Trace Particle','Stop Tracing Particles',
                ['clearParticlesButton','bombardButton','togglePathsButton']);
}

TraceUIControl.prototype.clearScreen = function() {
    //clear screen
    if(this.startPoint) { this.startPoint.remove(); }
    if(this.endPoint) { this.endPoint.remove(); }
    if(this.parab) { this.parab.removePath(); }
    if(this.path) { this.path.remove(); }
}

TraceUIControl.prototype.deactivate = function() {   
    this.clearScreen();
    this.resetVars();

    this.active = false;
    //set our button as well
    this.UIbutton.active = false;

    $j('#canvasHolder').css('cursor','default');
}

TraceUIControl.prototype.resetVars = function() {

    this.startPoint= null
    this.endPoint = null;
    this.parab = null;
    this.path = null;

    this.s = null;
    this.vel = null;
}


TraceUIControl.prototype.activate = function() {
    //just reset some variables
    this.resetVars();

    if(this.firstTime)
    {
        this.firstTime = false;
        topNotifyTemp("Left click, drag, and release to shoot",4000);
    }

    this.active = true;
    this.UIbutton.active = true;
    $j('#canvasHolder').css('cursor','crosshair');
}

TraceUIControl.prototype.rightClick = function(x,y) {
    //just return I think? or do a random arc from here
    return;
}

TraceUIControl.prototype.keyDown = function(which,e) {
    return;
}

TraceUIControl.prototype.mouseUp = function(x,y) {
    //make the particle and advance it once
    var k = new KineticState(this.s,this.vel,this.accel);

    var inside = false;
    var polys = polyController.polys;

    for(var j = 0; j < polys.length; j++)
    {
        if(polys[j].rPath.isPointInside(this.s.x,this.s.y))
        {
            inside = true;
            break;
        }
    }
    if(inside)
    {
        this.clearScreen();
        this.resetVars();
        return; //dont launch particles inside polygons
    }

    var particle = partController.makeParticle(k,this.accel);

    //DEBUG
    part = particle;

    //make sure to reset our vars
    this.clearScreen();
    this.resetVars();
}

TraceUIControl.prototype.leftClick = function(x,y) {
    //this is essentially the mousedown left click
    this.startPoint = cuteSmallCircle(x,y);

    this.s = {
        'x':x,
        'y':y
    };
 
    var now = new Date();
    this.startTime = now.getTime();

    this.mouseMove(x,y);
}

TraceUIControl.prototype.mouseMove = function(x,y,e) { 
    if(e && !e.which)
    {
        this.clearScreen();
        this.resetVars();
        return;
    }

    //only do the moving if our mouse is down
    if(!this.startPoint)
    {
        return;
    }

    var now = new Date();
    var time = now.getTime();

    if(time - this.startTime < 1000 && false)
    {
        return;
    }
    this.startTime = time;

    if(this.parab) { this.parab.removePath(); }
    if(this.path) { this.path.remove(); }
    if(this.endPoint) { this.endPoint.remove(); }

    //for mouse move, set the second point and make the velocity
    this.endPoint = cuteSmallCircle(x,y);

    this.e = {x:x,y:y};

    //make a path connecting them
    var pathString = constructPathStringFromPoints([this.startPoint,this.endPoint],false);
    this.path = cutePath(pathString);

    this.vel = {
        'x':x - this.s.x,
        'y':y - this.s.y
    };

    //now we have start, vel, and accel
    this.parab = new Parabola(this.s,this.vel,this.accel,true);
}


/**********END CLASSES******************/

function cuteSmallCircle(x,y,wantsSameColor) {
    var c = p.circle(x,y,4,4);

    if(wantsSameColor)
    {
        c.attr("fill","hsba(0.5,0.8,0.7,1)");
    }
    else
    {
        c.attr("fill","hsba(" + String(Math.random()) + ",0.8,0.7,1)");
    }

    c.attr("stroke","#FFF");
    c.attr("stroke-width",2);

    return c;
}

function constructPathStringFromPoints(points,wantsToClose) {

    var pathString = "M" + String(points[0].attr('cx')) + "," + String(points[0].attr('cy'));
    for(var i = 1; i < points.length; i++)
    {
        var s = "L" + String(points[i].attr('cx')) + "," + String(points[i].attr("cy"));
        pathString = pathString + s;
    }

    if(wantsToClose)
    {
        pathString = pathString + "Z";
    }

    return pathString;
}

function constructPathStringFromCoords(points,wantsToClose) {

    var pathString = "M" + String(Math.round(points[0].x)) + "," + String(Math.round(points[0].y));

    var lp = points[0];

    for(var i = 1; i < points.length; i++)
    {
        var s = " L" + String(Math.round(points[i].x)) + "," + String(Math.round(points[i].y));
        //var s = " l" + String(points[i].x - lp.x) + "," + String(points[i].y - lp.y);
        //lp = points[i];
        pathString = pathString + s;
    }

    if(wantsToClose)
    {
        pathString = pathString + " Z";
    }

    return pathString;
}



function randomHueString() {
    var hue = Math.random();
    var str = 'hsb(' + String(hue) + ',0.7,1)';
    return str;
}

function randomGradient() {
    var hue = Math.random()*0.8;
    var color1 = 'hsb(' + String(hue) + ',0.7,1)';
    var color2 = 'hsb(' + String(hue + 0.2) + ',0.9,1)';

    var gradient = String(Math.round(Math.random()*180)) + '-' + color1 + '-' + color2;

    return gradient;
}

function cutePath(pathString,wantsToFill,strokeColor) {
    var path = p.path(pathString);
    if(!strokeColor)
    {
        strokeColor = '#FFF';
    }
    path.attr({
        'stroke-width':2,
        'stroke':strokeColor,
        'stroke-linecap':'round',
        'stroke-linejoin':'round'
    });

    if(wantsToFill)
    {
        path.attr('fill',randomGradient());
        //path.attr('fill',randomHueString());
    }
    return path;
}

function windowResize(e) {
    var width = $j('#canvasHolder').width();
    var height = $j('#canvasHolder').height();

    p.setSize(width,height);
}

function onScreen(point,accel) {
    var x = point.x;
    var y = point.y;

    if(!accel)
    {
        throw new Error("no accel specified!");
    }

    var width = $j('#canvasHolder').width();
    var height = $j('#canvasHolder').height();

    //ok so there are four boundaries. we can't check the boundary that is OPPOSITE
    //the direction of the acceleration because the particle might come back down!

    var bottomCheck = function(x,y) {
        return y > 0;
    };
    var topCheck = function(x,y) {
        return y < height;
    };
    var leftCheck = function(x,y) {
        return x > 0;
    };
    var rightCheck = function(x,y) {
        return x < width;
    };

    //ok so then nullify the check that corresponds to our accel angle
    var accelAngle = vecAtan2(accel);

    //accel is pointing to the right
    if(accelAngle >= -Math.PI * 0.25 && accelAngle < Math.PI * 0.25)
    {
        leftCheck = null;
    }
    else if(accelAngle >= Math.PI * 0.25 && accelAngle < Math.PI * 0.75) //pointing up
    {
        bottomCheck = null;
    }
    else if(accelAngle >= Math.PI * 0.75 || accelAngle < -Math.PI * 0.75) // left
    {
        rightCheck = null;
    }
    else if(accelAngle < -Math.PI * 0.25 && accelAngle >= -Math.PI * 0.75) // down
    {
        topCheck = null;
    }
    else
    {
        console.warn("bad accel angle ",accelAngle);
    }

    var checks = [leftCheck,bottomCheck,rightCheck,topCheck];

    var checkResult = true;
    for(var i = 0; i < checks.length; i++)
    {
        if(checks[i])
        {
            checkResult = checkResult && checks[i](x,y);
        }
    }

    return checkResult;
    //we dont check for y because particles could come back down
}

function bombard() {
    bombardStep(0);
}

function bombardStep(i) {

    if(i > 10) { return; }

    var polys = polyController.polys;

    var parab = randomParab(false);
    var x = parab.pos.x;
    var y = parab.pos.y;

    var inside = false;
    for(var j = 0; j < polys.length; j++)
    {
        if(polys[j].rPath.isPointInside(x,y))
        {
            inside = true;
            break;
        }
    }

    if(inside)
    {
        bombardStep(i+1);
    }
    else
    {
        //make a particle and advance
        var k = new KineticState(parab.pos,parab.vel,parab.accel);
        var particle = partController.makeParticle(k,parab.accel);
    }
    setTimeout(function() {
        bombardStep(i+1)
    },200);
}

function toggleDebug()
{
    debug = !debug;
    if(debug)
    {
        $j('#debugButton').text('Stop Debugging');
    }
    else
    {
        $j('#debugButton').text('Debug');
    }
}

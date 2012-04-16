
/*****************CLASSES*******************/

function uiControl(parentObj) {
    this.active = false;
    this.UIbutton = null;
    this.parentObj = parentObj;

    //we have to bind the "this" scope to our object for the
    //event handlers
    var cc = function(e) {
        this.canvasClick(e);
    }
    var cm = function(e) {
        this.canvasMove(e);
    }
    var crc = function(e) {
        this.canvasRightClick(e);
    }
    var mu = function(e) {
        this.canvasMouseUp(e);
    }

    crc = crc.bind(this);
    cc = cc.bind(this);
    cm = cm.bind(this);
    mu = mu.bind(this);

    //register event handlers
    $j('#canvasHolder').bind('mousedown',cc);
    $j('#canvasHolder').bind('mousemove',cm);
    $j('#canvasHolder').bind('contextmenu',crc);
    $j('#canvasHolder').bind('mouseup',mu);
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
        this.parentObj.mouseMove(e.offsetX,e.offsetY);
    }
}

uiControl.prototype.canvasClick = function(e) {

    if(!this.parentObj.active)
    {
        return;
    }

    var x = e.offsetX;
    var y = e.offsetY;

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

function UIButton(parentObj,id,text,activeText) {

    this.active = false;
    this.parentObj = parentObj;

    this.text = text;
    this.activeText = activeText;
    this.id = id;

    var cHandler = function(e) {
        this.anchorClick();
    };
    cHandler = cHandler.bind(this);

    $j('#' + this.id).click(cHandler);
}

UIButton.prototype.anchorClick = function() {
    if(!this.active)
    {
        this.parentObj.activate();
        $j('#' + this.id).text(this.activeText);
        $j('.uiButton').filter(':not(#' + this.id + ')').slideUp();
    }
    else
    {
        this.parentObj.deactivate();
        $j('#' + this.id).text(this.text);
        $j('.uiButton').filter(':not(#' + this.id + ')').slideDown();
    }
}


/*^^^^^ general UI classes ^^^^*/
/*

 *->    specific UI classes <- */


function polygonUIControl() {

    this.uiPoints = [];
    this.uiPath = null;
    this.currentPoint = null;

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

    this.active = true;
    this.UIbutton.active = true;
    $j('#canvasHolder').css('cursor','crosshair');
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
        topNotify(String(e));
        setTimeout(function(){ topNotifyClear(); },3000);

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





function TraceUIControl() {

    this.prototype = new uiControl(this);
    this.UIbutton = new UIButton(this,'traceButton','Trace Particle','Stop Tracing Particles');
}

TraceUIControl.prototype.deactivate = function() {
    //remove our path and points from the screen
    if(this.startPoint) { this.startPoint.remove(); }
    if(this.endPoint) { this.endPoint.remove(); }

    if(this.uiPath) { this.uiPath.remove(); }
    if(this.currentPoint) { this.currentPoint.remove(); }

    this.active = false;
    //set our button as well
    this.UIbutton.active = false;

    $j('#canvasHolder').css('cursor','default');
}

TraceUIControl.prototype.activate = function() {
    //just reset some variables
    this.uiPoints = [];
    this.currentPoint = null;
    this.uiPath = null;

    this.active = true;
    this.UIbutton.active = true;
    $j('#canvasHolder').css('cursor','crosshair');
}

TraceUIControl.prototype.rightClick = function(x,y) {
    //just return I think? or do a random arc from here
    return;
}

TraceUIControl.prototype.mouseUp = function(x,y) {


}

TraceUIControl.prototype.leftClick = function(x,y) {

}

TraceUIControl.prototype.mouseMove = function(x,y) {

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

    var pathString = "M" + String(points[0].x) + "," + String(points[0].y);
    for(var i = 1; i < points.length; i++)
    {
        var s = "L" + String(points[i].x) + "," + String(points[i].y);
        pathString = pathString + s;
    }

    if(wantsToClose)
    {
        pathString = pathString + "Z";
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

function cutePath(pathString,wantsToFill) {
    var path = p.path(pathString);
    path.attr({'stroke-width':2,'stroke':'#FFF'});
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


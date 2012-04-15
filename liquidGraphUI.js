
//hacked up javascript clone object method from stackoverflow. certainly a blemish on the face of JS

/*****************CLASSES*******************/

var polygonUIControl = function() {

    this.uiPoints = [];
    this.uiPath = null;
    this.currentPoint = null;
    this.active = false;
    this.button = null;
    this.text = null;

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

    crc = crc.bind(this);
    cc = cc.bind(this);
    cm = cm.bind(this);

    //register event handlers
    $j('#canvasHolder').bind('mousedown',cc);
    $j('#canvasHolder').bind('mousemove',cm);
    $j('#canvasHolder').bind('contextmenu',crc);

    //draw our little ui object
    var topleftX = 10;
    var topleftY = 10;

    var width = 50; var height = 50;

    var centerX = width*0.5 + topleftX;
    var centerY = height*0.5 + topleftY;

    this.button = p.rect(topleftX,topleftY,width,height,10);

    this.button.attr('fill',"282-hsb(0.41286981720477345,0.7,1)-hsb(0.6128698172047735,0.9,1)");
    this.button.attr('stroke-width',3);
    this.button.attr('stroke','#FFF');
    this.button.attr('title','Add a polygon. Left click to add points, right click to close.');

    //use jquery to set the cursor
    $j(this.button.node).css('cursor','pointer');

    //now draw a little cross for the "+"
    this.text = p.text(centerX,centerY,'+');
    this.text.attr({'font-size':35,'fill':'#FFF'});

    //set the cursor also, and make it not selectable
    $j(this.text.node).css('cursor','pointer');
    $j(this.text.node).css('-khtml-user-select','none');

    //set their ids for the click handling
    $j(this.text.node).attr('id','inserterButtonText');
    $j(this.button.node).attr('id','inserterButton');

    //now bind a click handler to both
    var clickHandler = function(e) {
        this.buttonClick(e);
    }
    clickHandler = clickHandler.bind(this);

    this.text.click(clickHandler);
    this.button.click(clickHandler);

}

polygonUIControl.prototype.buttonClick = function(e) {
    if(!this.active)
    {
        this.button.attr('fill',"78-hsb(0.41286981720477345,0.7,1)-hsb(0.6128698172047735,0.9,1)");
        this.text.attr('stroke','#000');
        this.activate();
    }
    else
    {
        this.button.attr('fill',"282-hsb(0.41286981720477345,0.7,1)-hsb(0.6128698172047735,0.9,1)");
        this.text.attr('stroke','#FFF');
        this.deactivate();
    }
}

polygonUIControl.prototype.toggle = function() {
    if(this.active)
    {
        this.deactivate();
    }
    else
    {
        this.activate();
    }
}

polygonUIControl.prototype.deactivate = function() {
    //remove our path and points from the screen
    $j.each(this.uiPoints,function(index,point) {
        point.remove();
    });

    if(this.uiPath) { this.uiPath.remove(); }
    if(this.currentPoint) { this.currentPoint.remove(); }

    this.active = false;
    $j('#canvasHolder').css('cursor','default');
}

polygonUIControl.prototype.activate = function() {
    //just reset some variables
    this.uiPoints = [];
    this.currentPoint = null;
    this.uiPath = null;

    this.active = true;
    $j('#canvasHolder').css('cursor','crosshair');
}

polygonUIControl.prototype.canvasRightClick = function(e) {
    if(this.active)
    {
        e.preventDefault();
    }
}

polygonUIControl.prototype.canvasMove = function(e) {
    if(!this.active)
    {
        return;
    }

    this.mouseMove(e);
}

polygonUIControl.prototype.canvasClick = function(e) {

    if(!this.active)
    {
        return;
    }

    //check if we hit our own button. god we even have to catch the
    //highlighted text click target here. ui controls are a beezy
    if(e.target.id == 'inserterButtonText' || e.target.id == 'inserterButton' || $j(e.target).text() == '+')
    {
        //return and let the other event handler do its thing
        return;
    }

    if(e.target.nodeName == 'rect' || e.target.nodeName == 'tspan')
    {
        console.log(e.target);
        console.log($j(e.target).text());
        console.warn('hitting other button, what to do?');
    }

    var x = e.offsetX;
    var y = e.offsetY;

    if(e.which == 1)
    {
        this.leftClick(x,y);
    }
    else
    {
        this.rightClick(x,y);
    }
}

polygonUIControl.prototype.rightClick = function(x,y) {

    //close the path basically and make a polygon with this
    var c = cuteSmallCircle(x,y);
    this.uiPoints.push(c);

    var aPath = constructPathStringFromPoints(this.uiPoints,true);

    //$j.each(uiPoints,function(i,point) { point.remove(); });
    this.uiPath.remove();

    //to dump this
    var asd = cutePath(aPath,true);

    this.uiPoints = [];

    //TODO: construct the polygon here!!!
    var polygon = new Polygon();
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

polygonUIControl.prototype.canvasMove = function(e) {
    if(!this.active) { return; }

    this.mouseMove(e.offsetX,e.offsetY);
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

function cuteSmallCircle(x,y,wantsSameColor) {
    var c = p.circle(x,y,6,6);

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


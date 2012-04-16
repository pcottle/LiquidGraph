
/*****************CLASSES*******************/

function polygonUIControl() {

    this.uiPoints = [];
    this.uiPath = null;
    this.currentPoint = null;

    this.active = false;
    this.UIbutton = null;

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

    var colors = {
        activeFill:"78-hsb(0.41286981720477345,0.7,1)-hsb(0.6128698172047735,0.9,1)",
        deactiveFill:"282-hsb(0.41286981720477345,0.7,1)-hsb(0.6128698172047735,0.9,1)"
    };

    var pos = {'x':10, 'y':10};
    var size = {'width':50,'height':50};
    var text = "+";
    var toolTip = "Add a polygon. Left click to add points, right click to close";
    var ids = {buttonId:"inserterButton",textId:"inserterButtonText"};

    //now do the UI button
    this.UIbutton = new UIButton(this,pos,size,colors,text,toolTip,ids);

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
    if(e.target.id == this.UIbutton.ids.buttonId || 
        e.target.id == this.UIbutton.ids.textId || $j(e.target).text() == this.UIbutton.buttonText)
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




function UIButton(parentObj,position,size,colors,buttonText,buttonToolTip,ids) {

    this.active = false;
    this.button = null;
    this.parentObj = parentObj;
    this.text = null;

    this.ids = ids;
    this.buttonText = buttonText;
    this.activeFill = colors.activeFill;
    this.deactiveFill = colors.deactiveFill;

    var topleftX = position.x;
    var topleftY = position.y;

    var width = size.width; var height = size.height;

    var centerX = width*0.5 + topleftX;
    var centerY = height*0.5 + topleftY;

    this.button = p.rect(topleftX,topleftY,width,height,10);

    this.button.attr('fill',this.deactiveFill);
    this.button.attr('stroke-width',3);
    this.button.attr('stroke','#FFF');
    this.button.attr('title',buttonToolTip);

    //use jquery to set the cursor
    $j(this.button.node).css('cursor','pointer');

    //now draw a little cross for the text
    this.text = p.text(centerX,centerY,this.buttonText);
    this.text.attr({'font-size':35,'fill':'#FFF'});

    //set the cursor also, and make it not selectable
    $j(this.text.node).css('cursor','pointer');
    $j(this.text.node).css('-khtml-user-select','none');

    //set their ids for the click handling
    $j(this.text.node).attr('id',ids.textId);
    $j(this.button.node).attr('id',ids.buttonId);

    //now bind a click handler to both
    var clickHandler = function(e) {
        this.buttonClick(e);
    }

    clickHandler = clickHandler.bind(this);

    this.text.click(clickHandler);
    this.button.click(clickHandler);
}

UIButton.prototype.buttonClick = function(e) {
    if(!this.active)
    {
        this.button.attr('fill',this.activeFill);
        this.text.attr('stroke','#000');
        this.parentObj.activate();
    }
    else
    {
        this.button.attr('fill',this.deactiveFill);
        this.text.attr('stroke','#FFF');
        this.parentObj.deactivate();
    }
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


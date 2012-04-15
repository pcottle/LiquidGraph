
//hacked up javascript clone object method from stackoverflow. certainly a blemish on the face of JS

/*****************CLASSES*******************/

var points = [];
var path = null;
var currentPoint = null;

function cuteSmallCircle(x,y) {
    var c = p.circle(x,y,6,6);

    c.attr("fill","hsba(" + String(Math.random()) + ",0.8,0.7,1)");
    c.attr("stroke","#FFF");
    c.attr("stroke-width",2);

    return c;
}

function canvasRightClick(e) {
    e.preventDefault();
}

function canvasClick(e) {
    console.log('yo');
    //TODO: decide what do to here
    if(e.target.nodeName != 'svg' && false)
    {
        //we clicked something on the canvas, let that event handler deal with it
        return;
    }

    var x = e.offsetX;
    var y = e.offsetY;
    if(e.which == 1)
    {
        polygonBuilderClick(x,y);
    }
    else
    {
        polygonBuilderRightClick(x,y);
    }

    return;

    var isBig = true;

    var c = p.circle(x,y,25,25);

    c.attr("fill","hsba(" + String(Math.random()) + ",0.8,0.7,1)");
    c.attr("stroke","#FFF");
    c.attr("stroke-width",3);

    var f = function() {
       if(isBig)
       {
           c.animate({'r':10},800,'easeInOut');
           isBig = false;
       }
       else
       {
           isBig = true;
           c.animate({'r':25},800,'easeInOut');
       }
    };

    c.click(function() {
        f();
    });
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

function polygonBuilderClick(x,y) {

    var c = cuteSmallCircle(x,y);
    if(path)
    {
        path.remove();
    }
    points.push(c);
    //do a move to restore the path
    buildingMove({offsetX:x,offsetY:y});

}

function polygonBuilderRightClick(x,y) {
    if(points.length)
    {
        //close the path basically and make a polygon with this
        var c = cuteSmallCircle(x,y);
        points.push(c);

        var aPath = constructPathStringFromPoints(points,true);
        //$j.each(points,function(i,point) { point.remove(); });
        path.remove();
        var asd = cutePath(aPath,true);
        points = [];
    }
}

function canvasMove(e) {
    //button sensitive move
    if(e.which) {
        return;
    }

    if(points.length)
    {
        buildingMove(e);
    }
}

function buildingMove(e) {
    if(currentPoint)
    {
        currentPoint.remove();
    }

    var x = e.offsetX;
    var y = e.offsetY;

    currentPoint = cuteSmallCircle(x,y);

    var pointsCopy = points.slice(0);
    pointsCopy.push(currentPoint);

    var pathString = constructPathStringFromPoints(pointsCopy,true);

    if(path) { path.remove(); }

    path = cutePath(pathString);
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

    var gradient = '0-' + color1 + '-' + color2;

    console.log(gradient);
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



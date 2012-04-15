
//hacked up javascript clone object method from stackoverflow. certainly a blemish on the face of JS

/*****************CLASSES*******************/

var points = [];
var path = null;

function cuteSmallCircle(x,y) {
    var c = p.circle(x,y,4,4);

    c.attr("fill","hsba(" + String(Math.random()) + ",0.8,0.7,1)");
    c.attr("stroke","#FFF");
    c.attr("stroke-width",3);

    return c;
}

function canvasClick(e) {
    if(e.target.nodeName != 'svg')
    {
        //we clicked something on the canvas, let that event handler deal with it
        return;
    }

    var x = e.offsetX;
    var y = e.offsetY;

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

function polygonBuilderClick(x,y) {
    var c = p.circle(x,y,10,10);

}

function canvasMove(e) {
    //only executes when holding down the button
    if(!e.which) {
        return;
    }
}

function resizeWindow(e) {
    var width = $j('#canvasHolder').width();
    var height = $j('#canvasHolder').height();

    p.setSize(width,height);
}



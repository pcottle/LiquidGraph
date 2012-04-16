//Globals
var pointOverlapTolerance = 5;
var endpointPointOverlapTolerance = 1.5;
/*********** CLASSES ********/

function Vertex(x,y,rPoint,parentPoly) {
    this.x = x;
    this.y = y;
    this.rPoint = rPoint;
    this.parentPoly = parentPoly;

    this.inEdge = null;
    this.outEdge = null;
}

Vertex.prototype.highlight = function() {
    this.rPoint.animate({
        'r':6,
        'stroke':'#000',
        'stroke-width':3,
    },800,'easeInOut');
}

Vertex.prototype.concaveTest = function() {
    //the concavity test is as follows:
    //
    //get the two adjacent vertices. if the avg of those two
    //vertices is inside our path, then we are convex,
    //otherwise we are concave

    //note: the ordering of the edges is very sensitive here
    var before = this.inEdge.p1;
    var after = this.outEdge.p2;

    //we have to test a bunch of points on the line. I wish there was a way
    //in Raphael to just test if an entire line lies within a polygon or not
    this.isConcave = true;

    //bit both 0.01 and 0.99. this test isn't as robust as I would like it to be but
    //it's good enough in practice
    for(var t = 0.01; t < 1; t += 0.098)
    {
        var point = convexCombo(before,after,t);
        var inside = this.parentPoly.rPath.isPointInside(point.x,point.y);

        //we only need ONE point to lie inside the polygon on the 'ear'
        //in order to classify this as convex
        if(inside)
        {
            this.isConcave = false;
            break;
        }
    }

    return this.isConcave;
}



//takes in a collection of raphael points,
//validates these points as a valid polygon,
//and then displays on the screen
function Polygon(rPoints,rPath) {
    this.rPoints = rPoints;
    this.rPath = rPath;

    this.vertices = [];
    this.concaveVertices = [];
    this.edges = [];

    this.rPath.toFront();

    for(var i = 0; i < this.rPoints.length; i++)
    {
        var rPoint = this.rPoints[i];
        rPoint.toFront();

        var x = rPoint.attr('cx');
        var y = rPoint.attr('cy');
    
        var vertex = new Vertex(x,y,rPoint,this);
        this.vertices.push(vertex);
    }

    //first validate the polygon
    this.validatePolygon();

    //classify vertices
    this.classifyVertices();
}

Polygon.prototype.classifyVertices = function() {
    for(var i = 0; i < this.vertices.length; i++)
    {
        var vertex = this.vertices[i];
        if(vertex.concaveTest())
        {
            vertex.highlight();
            this.concaveVertices.push(vertex);
        }
    }
}

Polygon.prototype.validatePolygon = function() {
    //make sure no two points on top of each other (or within a few pixels)
    this.validatePoints();

    //now go make all the edges
    this.buildEdges();

    //validate edges for intersections
    this.validateEdges();

}

Polygon.prototype.validateEdges = function() {
    //test all the edges against each other

    for(var i = 0; i < this.edges.length; i++)
    {
        var currEdge = this.edges[i];

        //minor speedup by specifying j = i to start
        for(var j = i; j < this.edges.length; j++)
        {
            if(j == i) { continue; }

            testEdge = this.edges[j];

            if(currEdge.intersectTest(testEdge))
            {
                throw new Error("Two edges intersect in that polygon!");
            }
        }
    }
}

Polygon.prototype.buildEdges = function() {
    for(var i = 0; i < this.vertices.length; i++)
    {
        var currPoint = this.vertices[i];

        if(i == this.vertices.length - 1)
        {
            var nextIndex = 0;
        }
        else
        {
            var nextIndex = i + 1;
        }

        var nextPoint = this.vertices[nextIndex];
        var edge = new Edge(currPoint,nextPoint);
        //edge.highlight();

        this.edges.push(edge);

        //set the edges for the vertices
        currPoint.outEdge = edge;
        nextPoint.inEdge = edge;
    }
}

Polygon.prototype.validatePoints = function() {
    for(var i = 0; i < this.vertices.length; i++)
    {
        currPoint = this.vertices[i];
        for(var j = i; j < this.vertices.length; j++)
        {
            if(j == i) { continue; }

            testPoint = this.vertices[j];

            var dist = distBetween(testPoint,currPoint);
            if(dist < pointOverlapTolerance)
            {
                throw new Error("Invalid Polygon -- Two points on top of each other");
            }
        }
    }
}

//controls the global polygons
var polygonController = function() {
    this.polys = [];
}

polygonController.prototype.add = function(poly) {
    this.polys.push(poly);
}


function parametricQuadSolver(a,b,c) {
    var solutions = solveQuadraticEquation(a,b,c);

    if(!solutions.results)
    {
        return [];
    }
    var ans1 = solutions.plusAns;
    var ans2 = solutions.negAns;

    //basically return the non-negative ones
    var answers = [];
    if(ans1 >= 0)
    {
        answers.push(ans1);
    }
    if(ans2 >= 0)
    {
        answers.push(ans2);
    }

    return answers;
}

function solveQuadraticEquation(a,b,c) {
    //if denom is invalid
    var denom = 2 * a;
    if(denom == 0)
    {
        return {results:false};
    }

    var underRoot = b*b - 4*a*c;
    if(underRoot < 0)
    {
        return {results:false};
    }

    var sqrRoot = Math.sqrt(underRoot);

    var numPlus = -b + sqrRoot;
    var numNeg = -b - sqrRoot;

    var plusAns = numPlus / denom;
    var negAns = numNeg / denom;

    return {results:true,
            plusAns:plusAns,
            negAns:negAns
        };
}

function pointTheSame(p1,p2) {
    return p1.x == p2.x && p1.y == p2.y;
}

function distBetween(p1,p2) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

function Edge(p1,p2) {
    this.p1 = p1;
    this.p2 = p2;

    if(distBetween(p1,p2) < pointOverlapTolerance)
    {
        throw new Error("Invalid Polygon -- Edge with two points on top of each other!");
    }
}

Edge.prototype.highlight = function() {
    var pathStr = constructPathStringFromCoords([this.p1,this.p2]);
    this.path = p.path(pathStr);
    this.path.glow();
    this.path.attr({
        'stroke':'#F00',
        'stroke-width':3
    });
}

//returns true if two edges intersect in a point that is within both edges
//and not defined by their endpoints

Edge.prototype.intersectTest = function(otherEdge) {

    //first get the point of line intersection between these two
    var intersectPoint = lineLineIntersection(this.p1,this.p2,otherEdge.p1,otherEdge.p2);
    if(!intersectPoint)
    {
        //no intersection point at all, so either these edges are parallel or colinear.
        //
        //lets first check for colinearity. if the 'center point' of edge1 is within
        //edge2 or the 'center point' of edge2 is within edge1, then return true because
        //they are on top of each other. otherwise return false
        var myCenter = centerPoint(this.p1,this.p2);
        var otherCenter = centerPoint(otherEdge.p1,otherEdge.p2);

        if(otherEdge.containsInsideEndpoints(myCenter) || this.containsInsideEndpoints(otherCenter))
        {
            return true;
        }

        return false;
    }

    //check that this intersection point is within both edges
    var withinTest = this.pointWithin(intersectPoint) && otherEdge.pointWithin(intersectPoint);

    if(!withinTest)
    {
        //no the intersection point isnt within the edges, don't worry about it
        return false;
    }

    //finally, both edges must contain these points for it to be a true intersection
    return this.containsInsideEndpoints(intersectPoint) && otherEdge.containsInsideEndpoints(intersectPoint);
}

Edge.prototype.containsInsideEndpoints = function(testPoint) {
    //first check if its within, then do the tolerance check against the endpoints
    if(!this.pointWithin(testPoint))
    {
        return false;
    }
    //now check min distance thing
    var minDist = Math.min(distBetween(this.p1,testPoint),distBetween(this.p2,testPoint));

    var tol = endpointPointOverlapTolerance;

    if(minDist < tol)
    {
        //just a point point intersect
        return false;
    }
    //truly within and not on top
    return true;
}

//returns true when the testPoint lies within our edge endpoints
Edge.prototype.pointWithin = function(testPoint) {
    //to do this, make a vector from edgePoint1 to testPoint.
    //then make a vector from edgePoint1 to edgePoint 2.

    var p1ToTest = makeVec(this.p1,testPoint);
    var p1ToP2 = makeVec(this.p1,this.p2);

    //take the dot between these two vectors. we already know they are colinear, so
    //we don't have to worry about the cosine angle stuff. if this dot product is not positive
    //(aka they are facing opposite directions), then return false
    var dotProduct = vecDot(p1ToTest,p1ToP2);
    if(dotProduct <= 0)
    {
        return false;
    }

    //next, if they are facing in the same direction, take the length of the first vec
    //and compare it to the second
    if(vecLength(p1ToTest) <= vecLength(p1ToP2))
    {
        return true;
    }

    return false;
}

Edge.prototype.validateSolutionPoint = function(parabola,tValue) {
    var ax, ay, vx, vy, px, py;

    //the px and py are relative
    px = parabola.pStart.x - this.p1.x;
    py = parabola.pStart.y - this.p1.y;

    ax = parabola.accel.x; ay = parabola.accel.y;
    vx = parabola.vInit.x; vy = parabola.vInit.y;


    var solutionPoint = {
        x: parabola.pStart.x + tValue * vx + 0.5 * tValue * tValue * ax,
        y: parabola.pStart.y + tValue * vy + 0.5 * tValue * tValue * ay
    };

    //if we don't contain this point, get pissed because it was deceiving
    //and return
    if(!this.pointWithin(solutionPoint))
    {
        //not really on this edge...
        return null;
    }
    //there is a solution, and it lies within our endpoint! wahoo
    return {solutionPoint:solutionPoint,tValue:tValue};
}

Edge.prototype.parabolaIntersection = function(parabola) {
    //a parabola is defined as:
    //
    // pStart -> starting point of parabola (vec)
    // vInit -> starting velocity (vec)
    // accel -> acceleration direction (vec)
    var ax, ay, vx, vy, px, py;

    //the px and py are relative
    px = parabola.pStart.x - this.p1.x;
    py = parabola.pStart.y - this.p1.y;

    ax = parabola.accel.x; ay = parabola.accel.y;
    vx = parabola.vInit.x; vy = parabola.vInit.y;

    //we solve this via a clever parametric equation taken into a cross product
    //of the vector of our endpoints

    var ourVec = makeVec(this.p1,this.p2);

    var a = (0.5 * ax * ourVec.y - 0.5 * ay * ourVec.x);
    var b = (vx * ourVec.y - vy * ourVec.x);
    var c = (px * ourVec.y - py * ourVec.x);

    console.log(a,b,c);

    var tValues = parametricQuadSolver(a,b,c);

    if(tValues.length == 0)
    {
        //no solution to this
        return null;
    }

    //sort the tValues
    tValues.sort();

    //now loop through them.
    //
    /*
     * The reason why we have to loop through them (rather than just taking the
     * smallest one) is because we are solving a parabola / LINE intersection.
     * Hence, in certain cases, there would be two solutions to the parabola
     * and the line defined by this edge. Unfortunately, the first solution would
     * be a point on the parabola that was not on the edge and the second
     * solution would be a point that was on the edge. so originally the
     * parametric quad solver would throw out the higher solution and
     * the lower solution would get rejected at the validation step.
     * This was really tricky to find. I fixed it by instead looping
     * Through them in order so you consider all positive results.
     *
     */
    for(var i = 0; i < tValues.length; i++)
    {
        var tValue = tValues[i];
        var results = this.validateSolutionPoint(parabola,tValue);
        if(results)
        {
            return results;
        }
    }
    return null;
}

function Parabola(pStart,vInit,accel,dontDraw) {
    this.pStart = pStart;
    this.vInit = vInit;
    this.accel = accel;

    this.path = null;
    this.paths = [];

    //go draw ourselves
    if(!dontDraw)
    {
        this.drawParabolaPath(-1);
    }
}

Parabola.prototype.drawParabolaPath = function(tVal) {

    var angle = Math.atan2(this.vInit.x,this.vInit.y);
    if(angle < 0)
    {
        angle += 2*Math.PI;
    }

    var hueVal = map(angle,0,2*Math.PI,0,1);
    var hue = "hsb(" + String(hueVal) + ",0.7,0.9)";

    //convert this parabola into a quadratic bezier path
    this.path = this.getQuadraticBezierPath(tVal);
    this.path.attr({
        'stroke-width':3,
        'stroke':hue
    });
}

Parabola.prototype.removePaths = function() {
    if(this.path)
    {
        this.path.remove();
    }
}


Parabola.prototype.getPointYielder = function() {

    var pointYielder = function(tValue) {
        var thisX = this.pStart.x + tValue * this.vInit.x + 0.5 * tValue * tValue * this.accel.x;
        var thisY = this.pStart.y + tValue * this.vInit.y + 0.5 * tValue * tValue * this.accel.y;
        return {'x':thisX,'y':thisY};
    };
    pointYielder = pointYielder.bind(this);

    return pointYielder;
}

Parabola.prototype.getSlopeYielder = function() {

    var slopeYielder = function(tValue) {
        var slopeX = this.vInit.x + tValue * this.accel.x;
        var slopeY = this.vInit.y + tValue * this.accel.y;
        return {'x':slopeX,'y':slopeY};
    };
    slopeYielder = slopeYielder.bind(this);

    return slopeYielder;
}

Parabola.prototype.getQuadraticBezierPoints = function(tValue) {
    var pointYielder = this.getPointYielder();
    var slopeYielder = this.getSlopeYielder();

    //essentially we just need the first point, a point really far away,
    //and the intersection between the slopes of those two points

    var p1 = pointYielder(0);
    var slope1 = slopeYielder(0);
    var p2 = vecAdd(p1,slope1);

    var p3 = pointYielder(tValue);
    var slope2 = slopeYielder(tValue);
    var p4 = vecAdd(p3,slope2);

    var intersectPoint = lineLineIntersection(p1,p2,p3,p4);

    return {'C1':p1,'C2':intersectPoint,'C3':p3};
}

Parabola.prototype.getQuadraticBezierPath = function(desiredTimeVal) {

    //if our tVal is -1, we want to draw offscreen.
    //else, draw to a specific tVal

    var t = 0;

    if(!desiredTimeVal || desiredTimeVal < 0)
    {
        var pointYielder = this.getPointYielder();
        t = 1;
        var point = pointYielder(t);

        while(onScreen(point))
        {
            t += 1;
            point = pointYielder(t);
        }
    }
    else
    {
        t = desiredTimeVal;
    }

    var cPoints = this.getQuadraticBezierPoints(t);

    var c1 = cPoints.C1;
    var c2 = cPoints.C2;
    var c3 = cPoints.C3;

    var str = "";
    str = str + "M" + commaJoin(c1);
    str = str + " Q" + commaJoin(c2);
    str = str + " " + commaJoin(c3);

    var path = p.path(str);
    return path;
}


function Kinetic(pos,vel,accel) {
    this.pos = pos;
    this.vel = vel;
    this.accel = accel;
}

function Particle(startKinetic,onEdge) {
    this.startK = startKinetic;
    this.onEdge = onEdge;
}

//Advances the particle to the next
Particle.prototype.advance = function(edges) {
    //TODO: query the edges intelligently
    if(!edges)
    {
        edges = [];
        for(var i = 0; i < polyController.polys.length; i++)
        {
            edges = edges.concat(polyController.polys[i].edges);
        }
    }

    //now loop through and intersect your own poly with each

    //TODO: with the current kinetic not just start

    var sk = this.startK;

    //make a parabola but don't draw it right away
    //TODO:DEBUG
    var parab = new Parabola(sk.pos,sk.vel,sk.accel,true);
    this.parab = parab;

    //intersect this parab with each edge and take the min
    var tRecord = Number.MAX_VALUE;
    var found = false;

    for(var i = 0; i < edges.length; i++)
    {
        var edge = edges[i];    
        var results = edge.parabolaIntersection(parab);
        if(results)
        {
            found = true;
            var t = results.tValue;
            if(t < tRecord)
            {
                tRecord = t;
            }
        }
    }

    //now draw the parab until here
    if(found)
    {
        parab.drawParabolaPath(tRecord);
        var point = parab.getPointYielder()(tRecord);
        var asd = cuteSmallCircle(point.x,point.y);
        asd.glow();
    }
    else
    {
        parab.drawParabolaPath(-1); //till offscreen
    }

    return parab;
}






/**********END CLASSSES*************/

function commaJoin(p1)
{
    return String(p1.x) + "," + String(p1.y);
}


function map(input,iLower,iUpper,oLower,oUpper)
{
    return (oUpper - oLower) * (input - iLower) / (iUpper - iLower);
}

function makeVec(from,to)
{
    return {
        x:to.x - from.x,
        y:to.y - from.y
    };
}

function convexCombo(p1,p2,t)
{
    return {
        x:p1.x * t + p2.x * (1-t),
        y:p1.y * t + p2.y * (1-t)
    };
}

function centerPoint(p1,p2)
{
    return {
        x:p1.x * 0.5 + p2.x * 0.5,
        y:p1.y * 0.5 + p2.y * 0.5
    };
}

function vecDot(v1,v2) {
    return v1.x * v2.x + v1.y * v2.y;
}

function vecLength(vec) {
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
}

function vecAdd(vec1,vec2) {
    return {
        x:vec1.x + vec2.x,
        y:vec1.y + vec2.y
    };
}

//returns the intersection point (if one exists) between the two lines defined
//by p1,p2 and p3, p4. returns false if none exists
function lineLineIntersection(p1,p2,p3,p4) {
    var x1,x2,x3,x4,y1,y2,y3,y4;

    x1 = p1.x; x2 = p2.x; x3 = p3.x; x4 = p4.x;
    y1 = p1.y; y2 = p2.y; y3 = p3.y; y4 = p4.y;

    //first check for parallel
    var denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if(denom == 0)
    {
        return false;
    }

    //actual result exists, go ahead and compute. note, this is a transition from
    //integer to float math

    var numLeft = (x1*y2 - y1*x2);
    var numRight = (x3*y4 - y3*x4);

    var iX = (numLeft * (x3 - x4) - (x1 - x2) * numRight)/(denom); 
    var iY = (numLeft * (y3 - y4) - (y1 - y2) * numRight)/(denom);

    //return this
    return {'x':iX,'y':iY};
}

function m(x,y) {
    return {x:x,y:y};
}

function randomParab(dontDraw)
{
    var width = $j(window).width();
    var a = m(Math.random() * width, Math.random() * width);
    var b = m(Math.random() * 100 - 50, Math.random() * 100 - 50);
    var c = m(Math.random() * 20 - 10, Math.random() * 10 - 5);

    return new Parabola(a,b,c,dontDraw);
}


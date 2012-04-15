//Globals
var pointOverlapTolerance = 5;
var endpointPointOverlapTolerance = 1.5;
/*********** CLASSES ********/

//takes in a collection of raphael points,
//validates these points as a valid polygon,
//and then displays on the screen

var Polygon = function(rPoints,rPath) {
    this.rPoints = rPoints;
    this.rPath = rPath;

    this.points = [];
    this.edges = [];

    this.rPath.toFront();

    for(var i = 0; i < this.rPoints.length; i++)
    {
        var rPoint = this.rPoints[i];
        rPoint.toFront();

        this.points.push({
            'x':rPoint.attr('cx'),
            'y':rPoint.attr('cy')
        });
    }

    //first validate the polygon
    this.validatePolygon();
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
    for(var i = 0; i < this.points.length; i++)
    {
        var currPoint = this.points[i];

        if(i == this.points.length - 1)
        {
            var nextIndex = 0;
        }
        else
        {
            var nextIndex = i + 1;
        }

        var nextPoint = this.points[nextIndex];
        var edge = new Edge(currPoint,nextPoint);

        this.edges.push(edge);
    }
}

Polygon.prototype.validatePoints = function() {
    for(var i = 0; i < this.points.length; i++)
    {
        currPoint = this.points[i];
        for(var j = i; j < this.points.length; j++)
        {
            if(j == i) { continue; }

            testPoint = this.points[j];

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






function pointTheSame(p1,p2) {
    return p1.x == p2.x && p1.y == p2.y;
}

function distBetween(p1,p2) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

var Edge = function(p1,p2) {
    this.p1 = p1;
    this.p2 = p2;

    if(distBetween(p1,p2) < pointOverlapTolerance)
    {
        throw new Error("Invalid Polygon -- Edge with two points on top of each other!");
    }
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

function makeVec(from,to)
{
    return {
        x:to.x - from.x,
        y:to.y - from.y
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


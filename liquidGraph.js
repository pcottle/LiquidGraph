//Globals
var pointOverlapTolerance = 2;
var endpointPointOverlapTolerance = 1.5;
var globalAnimateSpeed = 0.3;

/*********** CLASSES ********/

function Vertex(x,y,rPoint,parentPoly) {
    this.x = x;
    this.y = y;
    this.rPoint = rPoint;
    this.parentPoly = parentPoly;

    this.id = polyController.requestId(this);

    this.inEdge = null;
    this.outEdge = null;
    this.isConcave = null;
};

Vertex.prototype.highlight = function() {
    this.rPoint.animate({
        'r':5,
        'stroke':'#000',
        'stroke-width':3,
    },800,'easeInOut');
};

Vertex.prototype.getOtherEdge = function(edge) {
    if(!this.inEdge || !this.outEdge) { throw new Error("null edges!"); }

    //this comparison works because the edges aren't typecasted to strings or anything
    if(this.inEdge == edge)
    {
        return this.outEdge;
    }
    return this.inEdge;
};

Vertex.prototype.concaveTest = function() {
    //the concavity test is as follows:
    //
    //take the cross product of the outward normal vs the
    //inward normal. This will be positive if the vector turned "outward",
    //but will be negative if the vector turned inward. But before this
    //we need to know if the polygon is ordered clockwised or counterclockwise...

    var before = this.inEdge.getOtherVertex(this);
    var after = this.outEdge.getOtherVertex(this);

    var inEdgeNormal = this.inEdge.outwardNormal;
    var outEdgeNormal = this.outEdge.outwardNormal;

    //we just take the cross here to determine concavity / convexity
    if(vecCross(outEdgeNormal,inEdgeNormal) > 0)
    {
        this.isConcave = !this.parentPoly.CCW;
    } else {
        this.isConcave = this.parentPoly.CCW;
    }

    return this.isConcave;
};



//takes in a collection of raphael points,
//validates these points as a valid polygon,
//and then displays on the screen
function Polygon(rPoints,rPath) {
    this.rPoints = rPoints;
    this.rPath = rPath;
    this.fillColor = rPath.attr('fill');

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

    this.determineOrdering();

    this.setBodyDragHandlers();
    this.setVertexDragHandlers();

    //classify vertices
    this.classifyVertices();
};

Polygon.prototype.determineOrdering = function() {
    //determine the area of the polygon. aka go around summing up
    //triangle areas of each edge,

    var totalArea = 0;

    for(var i = 0; i < this.edges.length; i++)
    {
        var thisArea = vecCross(this.edges[i].p1,this.edges[i].p2);
        totalArea += thisArea;
    }

    if(totalArea < 0)
    {
        this.CCW = true;
    }
    else
    {
        this.CCW = false;
    }
};

Polygon.prototype.setVertexDragHandlers = function () {
    var onDrag = function(dx,dy,x,y,e) {
        if(!polyEditor.active)
        {
            return;
        }

        if(this.dragPath) { this.dragPath.remove(); }
        if(this.dragCircle) { this.dragCircle.remove(); }
        if(this.dragOutline) { this.dragOutline.remove(); }

        var endPoint = vecMake(x,y);
        var startPoint = vecMake(this.startDragX,this.startDragY);

        if(!this.dragEndPoint) { //first time
            this.parentPoly.rPath.attr('fill','none');
        }
        this.dragEndPoint = endPoint;

        var pathString = constructPathStringFromCoords([startPoint,endPoint]);
        this.dragPath = cutePath(pathString,false);
        this.dragCircle = cuteSmallCircle(x,y);

        //go get all the vertices real quick
        var points = [];
        var vertices = this.parentPoly.vertices;
        for(var i = 0; i < vertices.length; i++)
        {
            if(vertices[i] != this)
            {
                points.push(vertices[i]);
            } else {
                points.push(endPoint);
            }
        }

        pathString = constructPathStringFromCoords(points,true);
        this.dragOutline = cutePath(pathString,true,'#FFF',this.parentPoly.fillColor);
    };

    var onEnd = function(e) {
        if(!polyEditor.active)
        {
            return;
        }

        if(this.dragPath) { this.dragPath.remove(); }
        if(this.dragCircle) { this.dragCircle.remove(); }
        if(this.dragOutline) { this.dragOutline.remove(); }

        //ok so we need to clone all the vertices, except for this one
        var vertices = this.parentPoly.vertices;
        var rPoints = [];

        for(var i = 0; i < vertices.length; i++)
        {
            if(vertices[i] != this)
            {
                rPoints.push(vertices[i].rPoint.clone());
            }
            else
            {
                rPoints.push(cuteSmallCircle(this.dragEndPoint.x,this.dragEndPoint.y));
            }
        }

        var newPathString = constructPathStringFromPoints(rPoints,true);
        var newPath = cutePath(newPathString,true,'#FFF',this.parentPoly.fillColor);

        //temporarily remove the parent poly
        polyController.remove(this.parentPoly);

        var results = polyController.makePolygon(rPoints,newPath);
        if(!results.failed)
        {
            this.parentPoly.rPath.remove();
            $j.each(this.parentPoly.vertices,function(i,vertex) { vertex.rPoint.remove(); });
        }
        else
        {
            //it failed so add ourselves back in
            polyController.add(this.parentPoly);
            this.parentPoly.rPath.attr('fill',this.parentPoly.fillColor);
        }

        this.dragEndPoint = null;
    };

    var onStart = function(x,y,e) {
        if(!polyEditor.active && !solveController.active)
        {
            return;
        }
        if(solveController.active)
        {
            solveController.vertexClick(this);
            return;
        }

        //this refers to the VERTEX being clicked!!
        this.parentPoly.dragVertex = this;

        this.startDragX = x;
        this.startDragY = y;
    };

    for(var i = 0; i < this.vertices.length; i++)
    {
        var v = this.vertices[i];
        v.rPoint.drag(onDrag,onStart,onEnd,v,v,v);
    }
};

Polygon.prototype.setBodyDragHandlers = function() {
    var onDrag = function(dx,dy,x,y,e) {

        if(!polyEditor.active)
        {
            return;
        }

        this.dragDeltaX = x - this.startDragX;
        this.dragDeltaY = y - this.startDragY;

        var tString = "T" + String(this.dragDeltaX) + "," + String(this.dragDeltaY);

        this.rPath.transform(tString);

        $j.each(this.vertices,function(i,vertex) {
            vertex.rPoint.attr({
                'cx':vertex.x + vertex.parentPoly.dragDeltaX,
                'cy':vertex.y + vertex.parentPoly.dragDeltaY
            });
        });
    };

    var onEnd = function(e) {
        //the delta x is what we need to shift everything by...

        //we really need to make a completely new polygon here

        var newPoints = [];
        for(var i = 0; i < this.vertices.length; i++)
        {
            newPoints.push(this.vertices[i].rPoint.clone());
        }
        var newPathString = constructPathStringFromPoints(newPoints,true);
        var newPath = cutePath(newPathString,true,'#FFF',this.fillColor);

        //we need to temporarily remove ourselves so validation doesnt fail
        polyController.remove(this);

        var results = polyController.makePolygon(newPoints,newPath);

        //if successful, clear ourselves out for good
        if(!results.failed)
        {
            this.rPath.remove();
            $j.each(this.vertices,function(i,vertex) { vertex.rPoint.remove(); });
        }
        else
        {
            //add ourselves back in
            polyController.add(this);

            //reset our translation?
            this.rPath.transform("");
            $j.each(this.vertices,function(i,vertex) {
                vertex.rPoint.attr({
                    'cx':vertex.x,
                    'cy':vertex.y
                });
            });
        }
    };

    var onStart = function(x,y,e) {

        if(!polyEditor.active)
        {
            return;
        }
    
        this.startDragX = x;
        this.startDragY = y;
    }

    this.rPath.drag(onDrag,onStart,onEnd,this,this,this);
};

Polygon.prototype.classifyVertices = function() {
    if(this.vertices.length == 3)
    {
        //all are convex, its a triangle.
        return;
    }

    for(var i = 0; i < this.vertices.length; i++)
    {
        var vertex = this.vertices[i];
        if(vertex.concaveTest())
        {
            vertex.highlight();
            this.concaveVertices.push(vertex);
        }
    }
};

Polygon.prototype.validatePolygon = function() {
    //make sure no two points on top of each other (or within a few pixels)
    this.validatePoints();

    //now go make all the edges
    this.buildEdges();

    //validate edges for intersections
    this.validateEdges();

};

Polygon.prototype.validateEdges = function() {
    //test all the edges against each other

    for(var i = 0; i < this.edges.length; i++)
    {
        var currEdge = this.edges[i];

        if(polyController.doesEdgeIntersectAny(currEdge,this))
        {
            throw new Error("An edge overlaps another edge in that polygon!");
        }

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
};

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
        var edge = new Edge(currPoint,nextPoint,this);

        this.edges.push(edge);

        //set the edges for the vertices
        currPoint.outEdge = edge;
        nextPoint.inEdge = edge;
    }
};

Polygon.prototype.isPointInside = function(point) {
    return this.rPath.isPointInside(point.x,point.y);
};

Polygon.prototype.clear = function() {
    this.rPath.remove();
    $j.each(this.vertices,function(i,vertex) {
        vertex.rPoint.remove();
    });
};

Polygon.prototype.validatePoints = function() {
    for(var i = 0; i < this.vertices.length; i++)
    {
        currPoint = this.vertices[i];

        if(polyController.isPointInAny(currPoint,this))
        {
            throw new Error("Invalid Polygon - Point inside other polygon!");
        }

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
};

/**************GLOBAL CONTROL OBJECTS *******************/

//controls the global polygons
function polygonController() {
    this.polys = [];
    this.allEdges = [];

    this.vertexIdToGive = 0;
    this.idToVertex = {};
};

//ensures no two vertices have same ID. i used to do this with random
//hashes and checking but that got ugly
polygonController.prototype.requestId = function(vertex) {
    this.vertexIdToGive++;

    this.idToVertex[this.vertexIdToGive] = vertex;
    return this.vertexIdToGive;
};

polygonController.prototype.getVertexById = function(id) {
    return this.idToVertex[id];
};

polygonController.prototype.reset = function() {
    for(var i = 0; i < this.polys.length; i++)
    {
        this.polys[i].clear();
    }

    this.polys = [];
    this.allEdges = []; //lol garbage collection
};


//node: we will destroy the points and path here if the polygon fails
//so make sure they are a cloned / duplicate if you want to preserve them

polygonController.prototype.makePolygon = function(rPoints,rPath) {
    try {
        var poly = new Polygon(rPoints,rPath);
    } catch (e) {
        topNotifyTemp(String(e));

        //we have to color this polygon red and remove it
        rPath.animate({'stroke':'#F00','stroke-width':20},800,'easeInOut');
        $j.each(rPoints,function(i,point) { point.animate({'r':0,'stroke':'#F00'},800,'easeInOut'); });

        //remove it in 1000 ms
        setTimeout(function() {
            rPath.remove();
            for(var i = 0; i < rPoints.length; i++)
            {
                rPoints[i].remove();
            }
        }, 1000);

        return {
            'poly':null,
            'failed':true,
        };
    }

    this.add(poly);
    return {
        'poly':poly,
        'failed':false
    };
};


polygonController.prototype.add = function(poly) {
    this.polys.push(poly);
    this.allEdges = this.allEdges.concat(poly.edges);
};

polygonController.prototype.doesEdgeIntersectAny = function(edge,sourcePoly) {

    for(var i = 0; i < this.polys.length; i++)
    {
        //dont check against yourself
        if(this.polys[i] == sourcePoly) { continue; }

        for(var j = 0; j < this.polys[i].edges.length; j++)
        {
            if(edge.intersectTest(this.polys[i].edges[j]))
            {
                return true;
            }
        }
    }
    return false;
};

polygonController.prototype.isPointInAny = function(point,sourcePoly) {

    for(var i = 0; i < this.polys.length; i++)
    {
        //dont check against yourself
        if(this.polys[i] == sourcePoly) { continue; }

        if(this.polys[i].isPointInside(point))
        {
            return true;
        }
    }
    return false;
};

polygonController.prototype.remove = function(poly) {
    //wish JS had a nice list remove like pyton
    for(var i = 0; i < this.polys.length; i++)
    {
        if(poly == this.polys[i])
        {
            this.polys.splice(i,1);
            i--;
            //should only be one polygon but just in case
        }
    }

    this.allEdges = [];
    //reset edges
    for(var i = 0; i < this.polys.length; i++)
    {
        this.allEdges = this.allEdges.concat(this.polys[i].edges);
    }
};

function particleController() {
    this.particles = [];

    this.wantsPaths = true;
};

particleController.prototype.add = function(part) {
    this.particles.push(part);
};

particleController.prototype.clearAll = function() {
    $j.each(this.particles,function(i,particle) {
        particle.clearAll();
    });
    this.particles = [];
};

particleController.prototype.makeParticle = function(kState,accel,beginState) {
    var particle = new Particle(kState,accel,beginState);
    this.particles.push(particle);

    particle.settle();
    if(this.wantsPaths)
    {
        particle.drawEntirePath();
    }
    particle.animate();

    return particle;
};

particleController.prototype.togglePathPreference = function() {
    if(this.wantsPaths)
    {
        $j.each(this.particles,function(i,particle) {
            particle.clearPath();
        });
        this.wantsPaths = false;
    }
    else
    {
        $j.each(this.particles,function(i,particle) {
            particle.drawEntirePath();
        });
        this.wantsPaths = true;
    }
};











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
};

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
};

function pointTheSame(p1,p2) {
    return p1.x == p2.x && p1.y == p2.y;
};

function distBetween(p1,p2) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
};

function Edge(p1,p2,parentPoly,outwardNormal) {
    this.p1 = p1;
    this.p2 = p2;
    this.parentPoly = parentPoly;

    this.midPoint = vecAdd(vecScale(this.p1,0.5),vecScale(this.p2,0.5));
    this.edgeSlope = vecSubtract(this.p2,this.p1);

    if(distBetween(p1,p2) < pointOverlapTolerance)
    {
        throw new Error("Invalid Polygon -- Edge with two points on top of each other!");
    }

    if(this.parentPoly && !outwardNormal)
    {
        this.outwardNormal = this.getOutwardNormal();
    }
    else
    {
        this.outwardNormal = outwardNormal;
    }
};

Edge.prototype.getOtherVertex = function(vertex) {
    if(!vertex || !this.p1 || !this.p2) { throw new Error("null arguments!"); }

    if(this.p1 == vertex)
    {
        return this.p2;
    }
    return this.p1;
};

Edge.prototype.getOutwardNormal = function() {
    //ok this is a bit hacked up but get avg point, get a given normal, displace a bit, and test
    //for inclusion in the polygon. i know i know this sucks but normal computational
    //geometry people get clockwise ordered vertices so it's easy, not for me with those
    //tricky users!!

    var midPoint = this.midPoint;

    var edgeSlope = this.edgeSlope;

    var aNormal = {
        'x':edgeSlope.y * -1,
        'y':edgeSlope.x
    };
    aNormal = vecNormalize(aNormal);

    //displace by a bit
    var testPoint = vecAdd(midPoint,vecScale(aNormal,0.01));

    //if this is inside, then negate!
    if(this.parentPoly.isPointInside(testPoint))
    {
        aNormal = vecNegate(aNormal);
    }

    //for debug, make an arrow
    if(debug)
    {
        new rArrow(midPoint,vecScale(aNormal,100));
        new rArrow(midPoint,edgeSlope);
    }

    return aNormal;
};

Edge.prototype.highlight = function() {
    var pathStr = constructPathStringFromCoords([this.p1,this.p2]);
    this.path = p.path(pathStr);
    this.path.glow();
    this.path.attr({
        'stroke':'#F00',
        'stroke-width':3
    });
};

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
};

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
};

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
};

Edge.prototype.validateSolutionPoint = function(parabola,tValue) {
    var ax, ay, vx, vy, px, py;

    //the px and py are relative
    px = parabola.pos.x - this.p1.x;
    py = parabola.pos.y - this.p1.y;

    ax = parabola.accel.x; ay = parabola.accel.y;
    vx = parabola.vel.x; vy = parabola.vel.y;


    var solutionPoint = {
        x: parabola.pos.x + tValue * vx + 0.5 * tValue * tValue * ax,
        y: parabola.pos.y + tValue * vy + 0.5 * tValue * tValue * ay
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
};

Edge.prototype.parabolaIntersection = function(parabola) {
    //a parabola is defined as:
    //
    // pos -> starting point of parabola (vec)
    // vel -> starting velocity (vec)
    // accel -> acceleration direction (vec)
    var ax, ay, vx, vy, px, py;

    //the px and py are relative
    px = parabola.pos.x - this.p1.x;
    py = parabola.pos.y - this.p1.y;

    ax = parabola.accel.x; ay = parabola.accel.y;
    vx = parabola.vel.x; vy = parabola.vel.y;

    //we solve this via a clever parametric equation taken into a cross product
    //of the vector of our endpoints

    var ourVec = makeVec(this.p1,this.p2);

    var a = (0.5 * ax * ourVec.y - 0.5 * ay * ourVec.x);
    if(a == 0)
    {
        //one tricky thing happens when you have completely vertical accel
        //and completely vertical edges. the denom goes to 0 because
        //there might be an infinite number of solutions; however for us,
        //we just want one, so perturb ax and ay a bit
        ax += 0.001;
        ay += 0.001;
        a = (0.5 * ax * ourVec.y - 0.5 * ay * ourVec.x);
    }


    var b = (vx * ourVec.y - vy * ourVec.x);
    var c = (px * ourVec.y - py * ourVec.x);

    var tValues = parametricQuadSolver(a,b,c);

    if(tValues.length == 0)
    {
        //no solution to this
        return null;
    }

    //sort the tValues
    //WOW ARE YOU KIDDING MEEeeee javascript your sort function fails
    //so badly. this caused a huge bug
    tValues.sort(function(a,b) { return a - b; });

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
};

function Parabola(pos,vel,accel,shouldDraw) {
    if(!pos || !vel || !accel)
    {
        throw new Error("undefined parameters!");
    }


    this.pos = pos;
    this.vel = vel;
    this.accel = accel;

    this.path = null;
    this.clickFunction = null;

    this.pointYielder = this.getPointYielder();
    this.slopeYielder = this.getSlopeYielder();

    //go draw ourselves
    if(shouldDraw)
    {
        this.drawParabolaPath(-1);
    }
};

Parabola.prototype.drawParabolaPath = function(tVal) {

    var hue = velocityHue(this.vel);

    //fix!! sometimes with VERY straight paths you get numerical imprecision
    //and the parabola line goes off the screen because the control point is so far away...

    //fix this via:
    var v1 = vecNormalize(this.vel);
    var v2 = vecNormalize(this.accel);

    var shouldGoBezier = true;

    if(vecDot(v1,v2) > 0.99)
    {
        //just make it from points
        var p1 = this.pointYielder(0);
        var p2 = this.pointYielder(tVal);

        var pString = constructPathStringFromCoords([p1,p2]);

        this.path = cutePath(pString);
        this.path.attr({
            'stroke-width':3,
            'stroke':hue
        });
        return;
    }

    //convert this parabola into a quadratic bezier path
    this.path = this.getQuadraticBezierPath(tVal);
    this.path.attr({
        'stroke-width':3,
        'stroke':hue
    });

    if(this.clickFunction)
    {
        this.path.click(this.clickFunction);
    }
};

Parabola.prototype.removePath = function() {
    if(this.path)
    {
        this.path.remove();
    }
};

Parabola.prototype.click = function(clickFunction) {
    this.clickFunction = clickFunction;

    if(this.path)
    {
        this.path.click(clickFunction);
    }
};


Parabola.prototype.getPointYielder = function() {

    var _this = this;
    var pointYielder = function(tValue) {
        var thisX = _this.pos.x + tValue * _this.vel.x + 0.5 * tValue * tValue * _this.accel.x;
        var thisY = _this.pos.y + tValue * _this.vel.y + 0.5 * tValue * tValue * _this.accel.y;
        return {'x':thisX,'y':thisY};
    };

    return pointYielder;
};

Parabola.prototype.getSlopeYielder = function() {

    var _this = this;
    var slopeYielder = function(tValue) {
        var slopeX = _this.vel.x + tValue * _this.accel.x;
        var slopeY = _this.vel.y + tValue * _this.accel.y;
        return {'x':slopeX,'y':slopeY};
    };

    return slopeYielder;
};

Parabola.prototype.getQuadraticBezierPoints = function(tValue) {
    var pointYielder = this.pointYielder;
    var slopeYielder = this.getSlopeYielder();

    //essentially we just need the first point and the point at which we want to stop drawing.
    //then define two lines based on the slopes there and intersect them for the control point!

    var p1 = pointYielder(0);
    var slope1 = slopeYielder(0);
    var p2 = vecAdd(p1,slope1);

    var p3 = pointYielder(tValue);
    var slope2 = slopeYielder(tValue);
    var p4 = vecAdd(p3,slope2);

    var intersectPoint = lineLineIntersection(p1,p2,p3,p4);

    return {'C1':p1,'C2':intersectPoint,'C3':p3};
};

Parabola.prototype.getEndTimeValue = function(desiredTimeVal) {

    //if our tVal is -1, we want to draw offscreen.
    //else, draw to a specific tVal
    var t = 0;

    if(!desiredTimeVal || desiredTimeVal < 0)
    {
        var pointYielder = this.pointYielder;
        t = 1;
        var point = pointYielder(t);

        while(onScreen(point,this.accel))
        {
            t += 1;
            point = pointYielder(t);
        }
    }
    else
    {
        t = desiredTimeVal;
    }

    return t;
};

Parabola.prototype.getQuadraticBezierPath = function(desiredTimeVal) {

    //if our tVal is -1, we want to draw offscreen.
    //else, draw to a specific tVal

    var t = this.getEndTimeValue(desiredTimeVal);

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
};


function KineticState(pos,vel,accel) {
    this.pos = pos;
    this.vel = vel;
    this.accel = accel;
};

KineticState.prototype.toParabola = function() {
    return new Parabola(this.pos,this.vel,this.accel);
};



function KineticTransitionPath(posYielder,velYielder,accelYielder,endTime) {
    this.pointYielder = posYielder;
    this.slopeYielder = velYielder;
    this.accelYielder = accelYielder;

    this.animateFunction = this.getAnimateFunction();
    this.animateTime = 0;
    this.endTime = endTime;
};

KineticTransitionPath.prototype.getAnimateFunction = function() {
    var _this = this;
    var f = function() {
        _this.animateStep();
    };
    return f;
};

KineticTransitionPath.prototype.animate = function(doneFunction) {
    this.doneFunction = doneFunction;
    this.animateSpeed = globalAnimateSpeed;

    //clear
    this.clearAnimation();

    var startPoint = this.pointYielder(0);
    var startVel = this.slopeYielder(0);

    this.pos = startPoint;
    this.vel = startVel;

    this.particleBody = cuteSmallCircle(startPoint.x,startPoint.y);
    this.ring = p.circle(startPoint.x,startPoint.y,40,40);
    this.ring.attr({
        'stroke':'rgba(255,255,255,0.5)',
        'fill':'rgba(0,0,0,0)',
        'stroke-width':5
    });
    this.vArrow = new rArrow(startPoint,startVel);

    //add ourselves to the bAnimator
    bAnimator.add(this.animateFunction);
};

KineticTransitionPath.prototype.animateStep = function() {
    this.animateTime += this.animateSpeed;

    if(this.animateTime > this.endTime)
    {
        this.animateTime = this.endTime;
    }

    this.pos = this.pointYielder(this.animateTime);
    this.vel = this.slopeYielder(this.animateTime);

    this.particleBody.attr({
        'cx':this.pos.x,
        'cy':this.pos.y
    });
    this.ring.attr({
        'cx':this.pos.x,
        'cy':this.pos.y
    });

    this.vArrow.update(this.pos,this.vel);

    if(this.animateTime < this.endTime)
    {
        bAnimator.add(this.animateFunction);
    }
    else
    {
        this.particleBody.remove();
        this.ring.remove();
        this.vArrow.path.remove();
        if(this.doneFunction)
        {
            this.doneFunction();
        }
    }
};

//kind of depreciated since we have bAnimator
KineticTransitionPath.prototype.clearAnimation = function() {
    if(this.particleBody) { this.particleBody.remove(); }
    if(this.ring) { this.ring.remove(); }
    if(this.vArrow) { this.vArrow.remove(); }

    this.animateTime = 0;
};


KineticTransitionPath.prototype.drawPath = function() {
    var posOne = this.pointYielder(0);
    var posTwo = this.pointYielder(this.endTime);

    var pathString = constructPathStringFromCoords([posOne,posTwo]);
    this.path = p.path(pathString);

    this.path.attr({
        'stroke-width':2,
        'stroke':velocityHue(this.slopeYielder(0)),
    });
};

KineticTransitionPath.prototype.clearPath = function() {
    if(this.path)
    { this.path.remove(); }
};

KineticTransitionPath.prototype.clearAll = function() {
    this.clearPath();
    this.clearAnimation();
};





function KineticPath(parabola,endTime) {

    this.pointYielder = parabola.pointYielder;
    this.slopeYielder = parabola.slopeYielder;
    this.parabola = parabola;

    //begin time is assumed to be 0

    //if the endTime is less than -1, we need to animate until it's offscreen.
    //hence, convert the time
    this.endTime = parabola.getEndTimeValue(endTime);

    this.particleBody = null;
    this.ring = null;
    this.vArrow = null;

    this.animateTime = 0;
    this.animateFunction = this.getAnimateFunction();
    this.doneFunction = null;
};

KineticPath.prototype.animate = function(doneFunction,wantsRing) {
    this.doneFunction = doneFunction;
    this.animateSpeed = globalAnimateSpeed;

    //clear our animation if we are starting over
    this.clearAnimation();

    //now set our graphical stuff to the beginning at t=0
    var startPoint = this.pointYielder(0);
    var startVel = this.slopeYielder(0);

    this.pos = startPoint;
    this.vel = startVel;

    this.particleBody = cuteSmallCircle(startPoint.x,startPoint.y);

    if(wantsRing) {
        this.ring = p.circle(startPoint.x,startPoint.y,40,40);
        this.ring.attr({
            'stroke':'rgba(255,255,255,0.5)',
            'fill':'rgba(0,0,0,0)',
            'stroke-width':5
        });
    }

    this.vArrow = new rArrow(startPoint,startVel);

    //start animation with timeout
    bAnimator.add(this.animateFunction);
};

KineticPath.prototype.getAnimateFunction = function() {
    var _this = this;
    var animate = function() {
        _this.animateStep();
    };

    return animate;
};

KineticPath.prototype.animateStep = function() {
    if(!this.animateSpeed) { throw new Error("animate speed not set!"); }

    this.animateTime += this.animateSpeed;

    if(this.animateTime > this.endTime)
    {
        this.animateTime = this.endTime;
    }

    //once time advances, update our stuff!
    this.pos = this.pointYielder(this.animateTime);
    this.vel = this.slopeYielder(this.animateTime);

    //move our particle body and update our arrow
    this.particleBody.attr({
        'cx':this.pos.x,
        'cy':this.pos.y
    });

    if(this.ring) //solution animation mode
    {
        this.ring.attr({
            'cx':this.pos.x,
            'cy':this.pos.y
        });
        this.parabola.removePath();
        this.parabola.drawParabolaPath(this.animateTime);
    }
 
    this.vArrow.update(this.pos,this.vel);

    //set another?
    if(this.animateTime < this.endTime)
    {
        //do the bulk animator object instead!
        bAnimator.add(this.animateFunction);
    }
    else
    {
        //we are done! call our parent done function. yay closures
        //also remove our body and arrow
        this.particleBody.remove();
        this.vArrow.path.remove();

        if(this.ring)
        {
            this.ring.remove();
        }
        this.doneFunction();
    }
};

KineticPath.prototype.clearAnimation = function() {
    if(this.particleBody) { this.particleBody.remove(); }
    if(this.vArrow) { this.vArrow.remove(); }

    this.animateTime = 0;
};

KineticPath.prototype.stopAnimating = function() {
    if(this.ourTimeout) {
        clearTimeout(this.ourTimeout);
    }
};

KineticPath.prototype.drawPath = function() {
    this.parabola.drawParabolaPath(this.endTime);
};

KineticPath.prototype.showEndpoint = function() {
    var point = this.pointYielder(this.endTime);

    this.clearAnimation();

    this.particleBody = cuteSmallCircle(point.x,point.y);
};

KineticPath.prototype.clearPath = function() {
    this.parabola.removePath();
};

KineticPath.prototype.clearAll = function() {
    this.clearPath();

    this.clearAnimation();
    this.stopAnimating();
};




function Particle(startKineticState,fieldAccel,beginState) {
    this.startKineticState = startKineticState;
    this.currentKineticState = startKineticState;

    if(!fieldAccel) { throw new Error("specify a field acceleration! We might not start in free fall"); }

    //the acceleration to restore once we go back to free falling.
    //because we might not start in free falling!!!
    this.fieldAccel = fieldAccel;

    //optional argument. gah i still wish JS had that support
    if(!beginState)
    {
        beginState = {
            name:'freeFall'
        };
    }

    //state is either:
    // name: freeFall
    //
    // name: onEdge, whichEdge: [Object Edge]
    //
    // name: offScreen
    //
    // name: settledAtVertex, whichVertex: [Object Vertex (concave)]

    this.traceState = beginState;

    //we would also like to keep track of path for animation and debugging support.
    //
    //we will do this by maintaining a list of point yielders, slope yielders and associated time intervals
    //to animate those point yielders through. that way we can playback a given particle trace.
    //
    //This combination of a point yielder / slope yielder / time interval is known as a "KineticPath"

    this.kPaths = [];
    this.kStates = [];
    this.tStates = [];

    this.kStates.push(this.currentKineticState);
    this.tStates.push(this.traceState);
};

//ELASTICITY
Particle.prototype.elasticity = 0.5;
Particle.prototype.edgeFriction = 0.2;

//advances the particle until it settles in a concave vertex or offscreen
Particle.prototype.settle = function() {
    var i = 0;
    var done = false;
    while(!done)
    {
        i += 1;
        var results = this.advance();
        done = results.done;

        if(i > 1000) { throw new Error("particle tracing did not terminate"); }
    }

    //get total time for settle
    var totalTime = 0;
    for(var i = 0; i < this.kPaths.length; i++)
    {
        totalTime += this.kPaths[i].endTime
    }

    if (this.traceState.name == 'offScreen') {
      this.settleResults = {
        'totalTime': totalTime,
        'endLocationName': 'offScreen',
        'endLocationObj': 'offScreen'
      };
    } else {
      this.settleResults = {
        'totalTime': totalTime,
        'endLocationName': this.traceState.whichVertex.id,
        'endLocationObj': this.traceState.whichVertex
      };
    }

    return this.settleResults;
};

//Advances the particle to the next collision or reflection point.
//
//If there is a collision or inflection point, the next kinetic state is calculated
//(along with the specific edge if applicable) and the function returns
Particle.prototype.advance = function() {
    var kPath = null;

    //if the particle is on an edge, then we do that logic
    if(this.traceState.name == 'onEdge')
    {
        kPath = this.edgeSlide();
    }
    //or we freefall
    else if(this.traceState.name == 'freeFall')
    {
        kPath = this.freeFall();
    }

    //if our state name is settled or offscreen, then stop animating.
    if(this.traceState.name == 'offScreen' || this.traceState.name == 'settledAtVertex')
    {
        return {'done':true,'kPath':kPath};
    }
    else
    {
        return {'done':false,'kPath':kPath};
    }
};

Particle.prototype.freeFall = function() {

    //TODO: query the edges intelligently. We might use a quadtree here eventually but
    //that's low on the priority list
    var edges = polyController.allEdges;

    //now loop through and intersect your own poly with each
    var sk = this.currentKineticState;

    //make a parabola but don't draw it right away
    var parab = sk.toParabola();
    this.parab = parab;

    //intersect this parab with each edge and take the min
    var tRecord = -1;
    var edgeHit = null;

    for(var i = 0; i < edges.length; i++)
    {
        var edge = edges[i];    
        var results = edge.parabolaIntersection(parab);

        if(results)
        {
            var t = results.tValue;

            //tRecord < 0 is for the initial assignment of -1, and we have -1
            //because that's our offscreen integer
            if(tRecord < 0 || t < tRecord)
            {
                tRecord = t;
                edgeHit = edge;
            }
        }
    }

    if(edgeHit)
    {
        //we should collide to update our kinetic state
        this.collide(parab,tRecord,edgeHit);
    }
    else
    {
        this.traceState = {name:'offScreen'};
    }

    //make a path. the neat thing here is that based on our tRecord, we will either
    //draw the parabola until it's offscreen or correctly draw it until it hits the
    //edge we collided with. yay parametric equations FTWwwwww

    var kPath = new KineticPath(parab,tRecord);

    if(debug)
    {
        var closure = this.makeDebugClosure(parab,tRecord,kPath,edgeHit);
        kPath.parabola.click(closure);
    }

    this.kPaths.push(kPath);
    return kPath;
};

Particle.prototype.makeDebugClosure = function(parab,tRecord,kPath,edgeHit) {

    var _this = this;

    var toReturn = function() {
        console.log("The particle");
        console.log(_this);
        console.log("The parabola");
        console.log(parab);
        console.log("The time we obtained");
        console.log(tRecord);
        console.log("The kinetic Path");
        console.log(kPath);
        if(edgeHit)
        {
            console.log("The edge we hit");
            console.log(edgeHit);
            edgeHit.highlight();
        }

        parab.path.glow();
    };

    return toReturn;
};

//updates kinetic state after a collision. Also in charge of determining if
//the particle is on edge or still free falling after a collision

Particle.prototype.collide = function(parabola,tValue,edge) {
    //we need to update our kinetic state with this projected velocity and decide
    //if we are on an edge or not!

    //first get the kinetic state RIGHT before the collision
    var pos = parabola.pointYielder(tValue);
    var preCollisionVelocity = parabola.slopeYielder(tValue);
    var accel = parabola.accel;

    //first project velocity onto edge, and see if it's on the edge now
    //after the tolerance check
    var results = this.projectVelocityOntoEdge(preCollisionVelocity,edge);
    var newVelocity = results.newVelocity;
    var onEdgeTest2 = results.nowOnEdge;

    //now determine if we are on the edge:
    //
    // do this by first seeing if the accel will keep us on the edge
    //
    // then look at result from collision
    var onEdgeTest1 = vecDot(accel,edge.outwardNormal) <= 0;

    //console.log('test1',onEdgeTest1,'test2',onEdgeTest2);

    var onEdge = onEdgeTest2 && onEdgeTest1;

    if(!onEdge)
    {
        //we are 'free falling' so save kinetic state and update state. easy.
        //
        //note: we have to advance slightly off the edge here to not get caught in that edge
        //solution!
        var bouncedOff = vecAdd(pos,vecScale(edge.outwardNormal,0.01));

        this.currentKineticState = new KineticState(bouncedOff,newVelocity,accel);
        this.traceState = {name:'freeFall'};

        this.kStates.push(this.currentKineticState);
        this.tStates.push(this.traceState);
    }
    else
    {
        //we are on an edge now... project our accel onto this edge
        var newAccel = this.projectVectorOntoEdge(accel,edge);

        //if our accel is 0, and our new velocity is zero, particle might not settle / move
        //
        //hence we might need to just stop here?
        if(vecLength(newAccel) < 0.1 && vecLength(newVelocity) < 0.1)
        {
            //we should see if this actually happens in practice...
            console.warn("Extremely low velocity and accel after collision");
            //cheat
            newAccel = vecScale(newAccel,2);
            newVelocity = vecScale(newVelocity,2);
        }

        this.currentKineticState = new KineticState(pos,newVelocity,newAccel);
        this.traceState = {
            name:'onEdge',
            whichEdge:edge
        };

        this.kStates.push(this.currentKineticState);
        this.tStates.push(this.traceState);
    }
};

Particle.prototype.projectVelocityOntoEdge = function(velocity,edge) {

    var nowOnEdge = false;

    if(vecDot(velocity,edge.outwardNormal) > 0 && vecDot(velocity,edge.outwardNormal) < 5)
    {
        console.log('wtf');
        //tolerance against side stuff
        velocity = vecNegate(velocity);
    }

    if(vecDot(velocity,edge.outwardNormal) > 0)
    {
        console.log("done with a velocity!!");
        console.log("result was",vecDot(velocity,edge.outwardNormal));
        console.log(velocity);

        //var asd = new rArrow(edge.p1,velocity);
        //edge.highlight();
        console.log(this);
        //part = this;

        throw new Error('Projecting vector onto edge with same facing outward normal!');
    }

    //get the edge slope unit vector
    var edgeSlope = vecNormalize(edge.edgeSlope);

    //if the dot product is negative, negate the edge slope
    if(vecDot(edgeSlope,velocity) < 0)
    {
        edgeSlope = vecNegate(edgeSlope);
    }

    //now dot these two, and divide by their lengths to get the cos(theta) term
    var cosTheta = vecDot(velocity,edgeSlope) / (vecLength(velocity) * 1);

    //now scale correctly with the fricton factor
    var newTangentVelocity = vecScale(edgeSlope,cosTheta * vecLength(velocity) * (1-this.edgeFriction));

    //get the elasticity rebound
    var newNormalVelocity = vecScale(vecSubtract(velocity,newTangentVelocity),this.elasticity);

    //we check for edge sliding by checking the cosTheta

    if(cosTheta > 0.975)
    {
        nowOnEdge = true;
        //BOOM BABY!!! the cosine check is really helpful for when the particle is settling into a
        //concave vertex hole, like
        //
        //    \    /
        //     \. /
        //      \/
        //
        //in short im glad I have both these checks in here

        newNormalVelocity.x =0.001; newNormalVelocity.y = 0.001;
    }
    else if(vecLength(newNormalVelocity) < 1)
    {
        nowOnEdge = true;
        //0's wreck havoc
        newNormalVelocity.x = 0.001; newNormalVelocity.y = 0.001;
    }

    //its a rebound for a reason
    newNormalVelocity = vecNegate(newNormalVelocity);

    //the new velocity is these two
    return {
        'newVelocity':vecAdd(newTangentVelocity,newNormalVelocity),
        'nowOnEdge':nowOnEdge
    };
};

Particle.prototype.projectVectorOntoEdge = function(vector,edge) {
    //get the edge slope unit vector
    var edgeSlope = vecNormalize(edge.edgeSlope);

    //if the dot product is negative, negate the edge slope
    if(vecDot(edgeSlope,vector) < 0)
    {
        edgeSlope = vecNegate(edgeSlope);
    }

    //now dot these two, and divide by their lengths to get the cos(theta) term
    var cosTheta = vecDot(vector,edgeSlope) / (vecLength(vector) * 1);

    //now scale correctly with the cos(theta) term
    var newTangentVector = vecScale(edgeSlope,cosTheta * vecLength(vector));

    //this is the projected vector
    return newTangentVector;
};


Particle.prototype.getArrivalVertex = function() { 

    if(this.traceState.name != 'onEdge') { throw new Error("dont call arrival vertex when not on edge!"); }
    if(!this.traceState.whichEdge) { throw new Error("null edge during sliding!"); }

    //ok so here's the tricky thing. there are two cases with edge sliding when determining
    //the vertex we will end up at:
    //
    //  1) our velocity and acceleration are pointing in the same direction. This means
    //     that our instantaneous direction at impact is the direction towards the vertex
    //     we will arrive at first
    //
    //  2) the second situation is where our acceleration and velocity are pointing in
    //     opposite directions. This means that the vertex of arrival (haha) is
    //     completely ambiguous.
    //
    //     To rectify these situations, I will do something tricky. I will define two lines
    //     , one at each vertex, and then use our parabola with the projected accel
    //     and velocity to solve for which vertex we cross first. This ends up being advantageous,
    //     for we need to determine the kinetic state at the vertex anyways, and rather than doing some
    //     horrible forward simulation (with super small or super large timesteps), we instead
    //     solve deterministically / parametrically and then just compute the required kinetic
    //     state at that edge.
    //
    // 

    var edge = this.traceState.whichEdge;
    var edgeNormal = vecScale(edge.outwardNormal,40);
    var edgeSlope = edge.edgeSlope;

    //ok so first define the edge at p1
    var p1Top = vecAdd(edge.p1,edgeNormal);
    var p1Bottom = vecAdd(edge.p1,vecNegate(edgeNormal));

    //pass in a defined outward normal so it doesnt do the test
    var p1BoundaryEdge = new Edge(p1Top,p1Bottom,null,edgeSlope);
    p1BoundaryEdge.__vertex = edge.p1;

    var p2Top = vecAdd(edge.p2,edgeNormal);
    var p2Bottom = vecAdd(edge.p2,vecNegate(edgeNormal));

    var p2BoundaryEdge = new Edge(p2Top,p2Bottom,null,edgeSlope);
    p2BoundaryEdge.__vertex = edge.p2;

    //p1BoundaryEdge.highlight();
    //p2BoundaryEdge.highlight();
    var boundaryEdges = [p1BoundaryEdge,p2BoundaryEdge];
    var parab = this.currentKineticState.toParabola();

    //we have our boundary edges. now go do a very similar looping and solve
    var tRecord = -1;
    var edgeHit = null;
    for(var i = 0; i < boundaryEdges.length; i++)
    {
        var results = boundaryEdges[i].parabolaIntersection(parab);

        if(results)
        {
            var t = results.tValue;
            if(tRecord < 0 || t < tRecord)
            {
                tRecord = t;
                edgeHit = boundaryEdges[i];
            }
        }
    }

    //if we dont have an edge hit here something is seriously wrong
    if(!edgeHit)
    {
        p1BoundaryEdge.highlight();
        p2BoundaryEdge.highlight();
        throw new Error("tried to intersect parabola with boundary edges but something failed.");
    }

    //now we know the kinetic state at vertex arrival AND the vertex we arrive at
    var arrivalVertex = edgeHit.__vertex;

    //using the arrival vertex for the position is FAR BETTER for numerical stability
    var arrivalPos = vecMake(arrivalVertex.x,arrivalVertex.y);
    var arrivalVel = parab.slopeYielder(tRecord);

    return {
        'arrivalVertex':arrivalVertex,
        'arrivalPos':arrivalPos,
        'arrivalVel':arrivalVel,
        'arrivalTime':tRecord
    };
};

Particle.prototype.clearPath = function() {
    $j.each(this.kPaths,function(i,kPath) { kPath.clearPath(); });
};

Particle.prototype.setOpacity = function(opacity) {
    $j.each(this.kPaths,function(i,kPath) { kPath.parabola.path.attr('stroke-opacity',opacity); });
}

Particle.prototype.clearAll = function() {
    $j.each(this.kPaths,function(i,kPath) { kPath.clearAll(); });

    //also clear the animations in bAnimator
    bAnimator.stopAnimating;

};

Particle.prototype.edgeSlide = function() {

    //first we must obtain the arrival vertex
    var arrivalResults = this.getArrivalVertex();

    //no matter what, this path now exists, so make it an add it.
    var kPath = new KineticPath(this.currentKineticState.toParabola(),arrivalResults.arrivalTime);
    this.kPaths.push(kPath);

    var arrivalVertex = arrivalResults.arrivalVertex;
    var arrivalVel = arrivalResults.arrivalVel;
    var arrivalPos = arrivalResults.arrivalPos;

    //ok so now we have all this GREAT information about our state
    //when we cross a vertex. here we branch into 3 different situations
    //
    //
    //      1) The vertex we arrive at is convex, in which we simply bump
    //         off a bit and then begin free falling at this position once more
    //
    //      2) The vertex we arrive at is concave, and the lines join at an angle
    //         of less than 90 degrees (no rebound), so we become settled immediately
    //
    //      3) the vertex we arrive at is concave, but the angle is more than 90 degrees,
    //         so we have to do the collision / projection logic again and begin edge sliding
    //         on THAT edge. we should also check for a velocity length here

    if(!arrivalVertex.isConcave)
    {
        this.easyEdgePop(arrivalResults);
        return;
    }

    //ok it's not as easy as the edgepop; we need to determine the angle between the two lines
    //that adjoin at this vertex. first, we need the "other edge"

    var edgeWeAreOn = this.traceState.whichEdge;
    var edgeWeAreHitting = arrivalVertex.getOtherEdge(edgeWeAreOn);

    var angleBetween = angleBetweenEdges(edgeWeAreOn,edgeWeAreHitting);

    //ok so if this anglebetween is less than 90
    if(angleBetween < Math.PI * 0.5)
    {
        //so the edge meets at an acute angle:
        //
        //      -------------
        //                 /
        //                /
        //               /

        //and the particle clearly is in the vertex in the corner. BUT! The particle
        //can sometimes be "shot" into this corner, so we need to check the acceleration
        //projection of the edge we are on and see if it leads into this corner.
        //We don't need to check the top because of geometry (it's correct, just hard to
        //explain).

        var accelEdgeOn = this.projectVectorOntoEdge(this.fieldAccel,edgeWeAreOn);
        var edgeSlopeAway = vecSubtract(edgeWeAreOn.getOtherVertex(arrivalVertex),arrivalVertex);

        //if this dot product is negative, just go edge trap
        if(vecDot(accelEdgeOn,edgeSlopeAway) <= 0)
        {
            this.easyEdgeTrap(arrivalResults);
            return;
        }
        //we are on this edge, BUT acceleration is making is roll out, so just
        //negate our velocity and restart

        edgeSlopeAway = vecNormalize(edgeSlopeAway);

        var newPos = vecAdd(arrivalVertex,vecScale(edgeSlopeAway,0.001));
        var newVel = vecMake(0,0);
        var newAccel = vecScale(accelEdgeOn,(1-this.edgeFriction));

        var newState = new KineticState(newPos,newVel,newAccel);
        this.currentKineticState = newState;

        this.traceState = {
            'name':'onEdge',
            'whichEdge':edgeWeAreOn
        };

        this.kStates.push(newState);
        this.tStates.push(this.traceState);
        return;
    }

    /***************** EDGE TRANSITION *****************/
    //final option. we need to collide onto this edge. we might end up edge sliding if
    //our rebound is low, or we might end up free falling if our rebound is high. hence, we call
    //to our awesome projection method

    var results = this.projectVelocityOntoEdge(arrivalVel,edgeWeAreHitting);
    var nowOnEdge = results.nowOnEdge; var newVelocity = results.newVelocity;

    //EDGE SETTLE VELOCITY TOLERANCE CONSTANT... 3 is ok but kinda long sometimes
    if(vecLength(newVelocity) <= 4)
    {
        this.easyEdgeTrap(arrivalResults);
        return;
    }

    if(results.nowOnEdge)
    {
        //our velocity is not small, so transition to edge sliding on this edge. we need 2 things:
        //
        //  1) the acceleration projected onto the edge
        //
        //  2) a position just slightly forward from the arrival position on the other edge
        //     so we dont accidentally solve the edge collision problem with t=0

        var newAccel = this.projectVectorOntoEdge(this.fieldAccel,edgeWeAreHitting);

        //scale accel by a bit just to simulate a lil friction
        newAccel = vecScale(newAccel,(1-this.edgeFriction));

        var otherVertex = edgeWeAreHitting.getOtherVertex(arrivalVertex);
        var directionWeAreHeaded = vecNormalize(vecSubtract(otherVertex,arrivalVertex));
        var newPos = vecAdd(arrivalPos,vecScale(directionWeAreHeaded,0.001));

        var newState = new KineticState(newPos,newVelocity,newAccel);

        this.currentKineticState = newState;
        this.traceState = {
            'name':'onEdge',
            'whichEdge':edgeWeAreHitting
        };

        this.tStates.push(this.traceState);
        this.kStates.push(newState);
        return;
    }

    //
    //  Here's the deal though. This is where there's a SUPER rare bug... think of the situation below:
    //
    //                    \o
    //                  e1 \
    //                      \
    //                       |
    //                    e2 |
    //
    //      The particle (o) is sliding on the edge e1. This edge e1 and e2 meet at a convex angle,
    //      so naturally the particle is going to be "free falling" after we finish sliding on
    //      e1. The problem (I think) is that we use the parabolic path for the e1 slide to yield the
    //      final point where this edge transition occurs. Sometimes, due to numerical imprecision,
    //      the point that is yielded is slightly _behind_ the line defined by e2. Thus, when we
    //      then cycle through the edges to look for the next edge that is hit, we actually get a solution
    //      for the e2 / new parabola intersection at what is, essentially, the vertex between the two.
    //      Then we think we are hitting this edge from behind, so the code barfs because we try to project
    //      a velocity onto an edge with the same outward facing normal.
    //      
    //      I just actually verified this in the debugger, and I got a solution of
    //      0.00000114454 for the next stage of the particle, meaning that it collided with the edge from
    //      behind :O. Let's try this:
    //          If we instead take our next starting position as the VERTEX, we actually get 0
    //          for the solution! Wahoo. Just to be safe, I might perturb it ever so slightly forward.
    //
    //      Also, I technically drew the edgePop situation above, but the same happens with the concave
    //      vertices that are almost flat. I changed the arrivalPosition to the vertex either way.

    var newAccel = this.fieldAccel;
    var bouncedOff = vecAdd(arrivalPos,vecScale(edgeWeAreHitting.outwardNormal,0.005));
    bouncedOff = vecAdd(bouncedOff,vecScale(edgeWeAreOn.outwardNormal,0.005));

    var newState = new KineticState(bouncedOff,newVelocity,newAccel);
    this.currentKineticState = newState;
    this.traceState = {
        'name':'freeFall'
    };

    this.kStates.push(newState);
    this.tStates.push(this.traceState);
};

Particle.prototype.easyEdgeTrap = function(arrivalResults) {

    //just set the position at the right spot, null out velocity and accel,
    //and then update our kinetic state / traceState

    var arrivalVertex = arrivalResults.arrivalVertex;
    var arrivalPos = arrivalResults.arrivalPos;
    var arrivalVel = vecMake(0,0);
    var arrivalAccel = vecMake(0,0);

    var endState = new KineticState(arrivalPos,arrivalVel,arrivalAccel);
    this.currentKineticState = endState;

    this.traceState = {
        'name':'settledAtVertex',
        'whichVertex':arrivalVertex
    };

    this.kStates.push(endState);
    this.tStates.push(this.traceState);
};


Particle.prototype.easyEdgePop = function(arrivalResults) {
    //ok here's what we do:
    //
    //  first, pop the position slightly away from the vertex we were just on.
    //
    //  then, continue free falling from there!

    var arrivalPos = arrivalResults.arrivalPos;
    var arrivalVel = arrivalResults.arrivalVel;
    var arrivalTime = arrivalResults.tRecord;

    var thisEdge = this.traceState.whichEdge;

    //bounce the position slightly upward. This is so we dont intersect our own edge
    //again when free falling / whatever

    var pushedUp = vecAdd(arrivalPos,vecScale(thisEdge.outwardNormal,0.0001));

    //now we have a new kinetic state here. get the original field acceleration when
    //free falling
    var originalAccel = this.fieldAccel;

    //make the kinetic state
    var kState = new KineticState(pushedUp,arrivalVel,originalAccel);
    this.currentKineticState = kState;

    //update your trace state
    this.traceState = {'name':'freeFall'};

    this.kStates.push(kState);
    this.tStates.push(this.traceState);
};

Particle.prototype.drawEntirePath = function() {
    $j.each(this.kPaths,function(i,kPath) {
        kPath.drawPath();
    });
};

Particle.prototype.animateStep = function(i) {
   if(i >= this.kPaths.length)
   {
        //we are done animating all paths! call our done function if we have one
        if(this.doneAnimatingFunction)
        {
            this.doneAnimatingFunction();
        }
        return; 
   }

   //make a done closure object
   var doneClosure = this.getDoneClosure(i+1);

   //animate this kPath and call us when done
   this.kPaths[i].animate(doneClosure,this.wantsRing);
};

Particle.prototype.getDoneClosure = function(num) {
    var _this = this;
    var toReturn = function() {
        _this.animateStep(num);
    };

    return toReturn;
};

Particle.prototype.animate = function(doneFunction,wantsRing) {
    //ok so the tricky here is that we need to animate each path in succession. so when a path finishes,
    //it must call it's parent particle to animate the next one. this is all done with closures and
    //timeouts.... aka reasons to absolutely love JS
    if(wantsRing)
    {
        this.wantsRing = true;
    }
    else
    {
        this.wantsRing = false;
    }

    if(doneFunction)
    {
        this.doneAnimatingFunction = doneFunction;
    }

    this.animateStep(0);
};


//this object takes in a concave vertex and samples out in different directions
function ConcaveVertexSampler(concaveVertices, fieldAccel) {
  if (!concaveVertices || !concaveVertices.length) {
    throw new Error('need array');
  }

  this.concaveVertices = concaveVertices;
  // TODO
  this.concaveVertex = concaveVertices[0];

  this.accelStrength = vecLength(fieldAccel);

  // TODO -- find the minimum in edges and out edges based on some acceleration vector?
  this.inEdge = this.concaveVertex.inEdge;
  this.outEdge = this.concaveVertex.outEdge;

  this.connectivity = {};
  this.animationInfo = {};
  this.connectedNodeNames = [];
  this.nameToObject = {};

  this.transitionSpeed = 25.5; //0.5 seconds to transition for the max case
}

ConcaveVertexSampler.prototype.sampleConnectivity = function() {
    //we will do this by edge. The interesting thing is that the counterclockwise vs clockwise connectivity doesn't really matter
    //unlike in Yusuke's code because we can rotate in any / either direction.

    this.sampleConnectivityFromEdge(this.inEdge);
    this.sampleConnectivityFromEdge(this.outEdge);
}

ConcaveVertexSampler.prototype.animateConnectivity = function() {

  //console.log(this.connectedNodeNames);
  //console.log(this.animationInfo);

  //now animate the "fastest" particles from each
  for (var i = 0; i < this.connectedNodeNames.length; i++) {
    var cName = this.connectedNodeNames[i];
    var animation = this.animationInfo[cName];
    animation.particle.animate();
  }
};

// TODO sampling from an edge also comes along with a specific vertex now
ConcaveVertexSampler.prototype.sampleConnectivityFromEdge = function(edge) {
    //this "edge" connects us to some other vertex. first get the normalized vector towards that edge:
    var otherVertex = edge.getOtherVertex(this.concaveVertex);
    var outVec = vecSubtract(otherVertex,this.concaveVertex);
    outVec = vecNormalize(outVec);

    //now we need the starting gravity direction, aka the negated outward normal of this edge
    var perpVec = vecNegate(edge.outwardNormal);

    //the start gravity direction and the max gravity direction are two vectors we need
    //for the following calculations
    var startG = vecScale(perpVec,this.accelStrength);
    var maxG = vecScale(outVec,this.accelStrength);

    //ok now we have an edge, a maximum gravity direction, and the starting gravity direction.
    //
    //lets go ahead and sample some particles inbetween these two extremes. we will
    //go through the range of 1 degree to 80 degrees in steps

    var startDegree = 1 * Math.PI / 180.0;
    var endDegree = 65 * Math.PI / 180.0;

    var degreeDelta = (endDegree - startDegree);
    var theta = 0;

    //NUMSAMPLES
    var numSamples = 10;

    for(var progress = 0; progress < 1; progress += 1/numSamples) {
      var theta = startDegree + progress * progress * progress * degreeDelta;

      var fraction = (theta - startDegree) / (endDegree - startDegree);
      var time = Math.max(0.1 * this.transitionSpeed, fraction * this.transitionSpeed);

      // NOW we are sampling multiple particles from this graivty transition!!!!!!!!!!! TODO
      var particle = this.sampleGravityTransition(edge,startG,maxG,theta,time,outVec,perpVec);

      if (particle) {
        particle.drawEntirePath();
        particle.setOpacity(1 - progress + 0.1);
      }
    }
};

// TODO -- we will first need to figure out when the acceleration vector that is sweeping will be equal to or more
// than our perpendicular vector. then that's where we start our time actually... (wait this wont work)


ConcaveVertexSampler.prototype.sampleGravityTransition = function(edge,startG,maxG,thetaEnd,timeToTransition,outVec,perpVec) {
    //ok so here is where we do some math. I already did this in matlab but here's the deal:
    //we need to create a function that linearly interpolates between the beginning theta (0) and the end theta(our parameter)
    //in time. then we need to create a kinetic path out of that function, see where it ends up, and then go finally
    //create a particle at that point with that velocity and shoot it off into space and see where it ends up.

    //we need to calculate the acceleration of this vector projected onto the edge. this has the format
    //
    // accel = sin(thetaEnd * t / tEnd) * |maxG|
    //
    // or, simplified as:
    //
    // accel = sin(Bt) * A
    //
    // we then integrate this once to obtain the velocity as a function of time. We solve for the constant so
    // velocity is 0 at the beginning
    //
    // vel = -cos(Bt) * A / B + A/B
    //
    // then we integrate once more to obtain the position as a function of time (with 0 initially). We get:
    //
    // pos = -1 * (A * (sin(Bt) - B*t))/ (B^2)
    //
    // where A = |maxG|, B = thetaEnd / tEnd

    // we will then calculate parameters at the end of the transition period. Namely, we will calculate the velocity and
    // position at the end of the transition. From there we can then just trace the particle with the given end gravity direction

    var A = vecLength(maxG);
    var B = thetaEnd / timeToTransition;
    var _this = this;

    var pos = function(t) {
        return -1 * (A * (Math.sin(B * t) - B * t)) / (B*B);
    };
    var vel = function(t) {
        return -1 * Math.cos(B*t) * A / B + A/B;
    }
    var accel = function(t) {
        return sin(B * t) * A;
    }

    var posYielder = function(t) {
        var posVec = vecAdd(_this.concaveVertex,vecScale(outVec,pos(t)));
        return posVec;
    };
    var velYielder = function(t) {
        var velVec = vecScale(outVec,vel(t));
        return velVec;
    };

    //make a modified kinetic path with these transition properties so we can animate the particle rolling
    var transitionParticle = new KineticTransitionPath(posYielder,velYielder,accel,timeToTransition);

    var endPosVal = pos(timeToTransition);
    var endVelVal = vel(timeToTransition);

    //end acceleration is a bit harder:
    //
    //     \___________ -> outVec
    //      |
    //      v perp vec
    //
    // theta is the angle between perpVec and the desired end gravity direction:

    var endAccelVec = vecAdd(vecScale(perpVec,Math.cos(thetaEnd)),vecScale(outVec,Math.sin(thetaEnd)));

    //need to actually move this "endposval" in the direction we are headed
    var realEndPos = vecAdd(this.concaveVertex,vecScale(outVec,endPosVal));

    //we need to check if this endPos is further than the other vertex
    var otherVertex = edge.getOtherVertex(this.concaveVertex);
    var edgeLength = vecLength(vecSubtract(otherVertex,this.concaveVertex));
    var concaveToPosLength = vecLength(vecSubtract(realEndPos,this.concaveVertex));

    if(edgeLength <= concaveToPosLength)
    {
        //we need to reject this particle because it rolls off the edge before we are done
        //transitioning gravity directions. it's somewhat impossible to model spinning gravity
        //direction parabolas with parametric equations and be able to solve their line
        //intersections with simple/normal equations. These particles could also start
        //hitting other things and edge sliding with transitioning accelerations which
        //would be just a giant explosion of difficulty (unless you were doing something
        //dumb like Euler integration on these particles). 
        return;
    }

    if(debug) { debugCircle(realEndPos.x,realEndPos.y); }

    var realEndVel = vecScale(outVec,endVelVal);
    var realEndAccel = vecScale(endAccelVec,vecLength(maxG));

    //also need the projected endaccel
    var slidingAccel = Particle.prototype.projectVectorOntoEdge(realEndAccel,edge);

    if(debug) { 
        var asd = new rArrow(realEndPos,vecScale(edge.outwardNormal,100));
        var dsa = new rArrow(realEndPos,realEndVel);
    }

    //now make a particle at this position, with this velocity, edge sliding on this edge, with the end field acceleration
    //but with the projected velocity in this case

    var kState = new KineticState(realEndPos,realEndVel,slidingAccel);
    var tState = {
        'name':'onEdge',
        'whichEdge':edge
    };

    var particleHere = new Particle(kState,realEndAccel,tState);
    partController.add(particleHere);

    try {
      var settleResults = particleHere.settle();
    } catch(e) {
      // lolz
      return;
    }

    this.postResults(settleResults,startG,realEndAccel,timeToTransition,particleHere,transitionParticle);
    return particleHere;
};

ConcaveVertexSampler.prototype.postResults = function(settleResults,startG,realEndAccel,timeToTransition,particle,transParticle) {
  // TODO -- we need to add all of these results together
  //here we store all the connectivity information. This is essentially a cost-sensitive closed list

  var totalTime = settleResults.totalTime;
  // pretend there is only one particle
  var endLocationName = Node.prototype.stringifyLocations([settleResults.endLocationObj])
  var endLocationObject = settleResults.endLocationObj;

  var animationInformation = {
    'endLocationName':endLocationName,
    'endLocationObj':endLocationObject,
    'startG':startG,
    'realEndAccel':realEndAccel,
    'timeToTransition':timeToTransition,
    'totalTime':totalTime,
    'particle':particle,
    'transParticle':transParticle,
  };

  if (!this.connectivity[endLocationName]) {

    this.connectivity[endLocationName] = totalTime;
    this.connectedNodeNames.push(endLocationName);
    this.animationInfo[endLocationName] = animationInformation;
    this.nameToObject[endLocationName] = endLocationObject;

  } else if(this.connectivity[endLocationName] > totalTime) {

    this.connectivity[endLocationName] = totalTime;
    this.animationInfo[endLocationName] = animationInformation;
  }
};



/**********END CLASSSES*************/

function commaJoin(p1)
{
    return String(p1.x) + "," + String(p1.y);
};


function map(input,iLower,iUpper,oLower,oUpper)
{
    return (oUpper - oLower) * (input - iLower) / (iUpper - iLower);
};

function makeVec(from,to)
{
    if(!from || !to) { throw new Error("using vecMake isntead!"); }
    return {
        x:to.x - from.x,
        y:to.y - from.y
    };
};

function convexCombo(p1,p2,t)
{
    return {
        x:p1.x * t + p2.x * (1-t),
        y:p1.y * t + p2.y * (1-t)
    };
};

function centerPoint(p1,p2)
{
    return {
        x:p1.x * 0.5 + p2.x * 0.5,
        y:p1.y * 0.5 + p2.y * 0.5
    };
};

function vecDot(v1,v2) {
    return v1.x * v2.x + v1.y * v2.y;
};

function vecCross(v1,v2) {
    return v1.x * v2.y - v1.y * v2.x;
};

function vecLength(vec) {
    if(vec == undefined || vec.x == undefined) { throw new Error("bad arg"); }

    return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
};

function vecAdd(vec1,vec2) {
    return {
        x:vec1.x + vec2.x,
        y:vec1.y + vec2.y
    };
};

function vecNormalize(vec) {
    var denom = vecLength(vec);
    return {
        x:vec.x / denom,
        y:vec.y / denom
    };
};

function vecSubtract(vec1,vec2) {
    return {
        x:vec1.x - vec2.x,
        y:vec1.y - vec2.y
    };
};

function vecNegate(vec) {
    return {
        x:-vec.x,
        y:-vec.y
    };
};

function vecAtan2(vec) {
    return Math.atan2(vec.y,vec.x);
};

function angleToVec(angle) {
    return {
        x:Math.cos(angle),
        y:Math.sin(angle)
    };
};

function vecScale(vec,scale) {
    return {
        x:vec.x * scale,
        y:vec.y * scale
    };
};

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
};

function m(x,y) {
    return {x:x,y:y};
};

function vecMake(x,y) {
    return {x:x,y:y};
};

function randomParab(shouldDraw)
{
    var width = $j(window).width();
    var a = m(Math.random() * width, Math.random() * width);
    var b = m(Math.random() * 100 - 50, Math.random() * 100 - 50);
    var c = m(Math.random() * 20 - 10, Math.random() * 10 - 5);

    return new Parabola(a,b,c,shouldDraw);
};

function velocityAngle(vel)
{
    var angle = Math.atan2(vel.x,vel.y);
    if(angle < 0)
    {
        angle += 2*Math.PI;
    }
    return angle;
};

/*
    returns the angle BETWEEN the edges at the junction / vertex point, aka
           * 
    \     /
     \   /
      \O/
       *

    where O is theta, even though the second vector is pointing out. we negate
    the second vector to do the calculation.
                                                    */

function angleBetweenEdges(edge1,edge2)
{
    //this function HEAVILY depends on edge point ordering being consistent around the boundary
    //of a polygon, but it is, so I think we are good
    var slope1 = edge1.edgeSlope;
    var slope2 = vecNegate(edge2.edgeSlope);

    var dotScaled = vecDot(slope1,slope2) / (vecLength(slope1) * vecLength(slope2));
    return Math.acos(dotScaled);
};

function velocityHue(vel)
{
    var angle = velocityAngle(vel);
    var hueVal = map(angle,0,2*Math.PI,0,1);
    return hue = "hsb(" + String(hueVal) + ",0.7,0.9)";
};

function velocityHueFaded(vel)
{
    var angle = velocityAngle(vel);
    var hueVal = map(angle,0,2*Math.PI,0,1);
    return hue = "hsba(" + String(hueVal) + ",0.7,0.9,0.1)";
};



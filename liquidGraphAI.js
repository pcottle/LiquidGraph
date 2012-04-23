/*********** The file for all the AI work. It's ironic that the AI code will be only a few
             hundred lines, while all the physics / graphics / UI are huge.

                                                                                ********/


/********* Classes **********/

function Node(locationObj,accelDirection) {
    if(!accelDirection) { throw new Error("need field accel at this node!"); }

    this.locationObj = locationObj;
    if(this.locationObj != 'offScreen')
    {
        this.locationName = this.locationObj.id;
    }
    else
    {
        this.locationName = 'offScreen';
    }

    if(locationObj == 'offScreen')
    {
        this.isGoal = true;
        this.cvs = null;
        return;
    }
    console.log("making concave vertex sampler");

    this.cvs = new ConcaveVertexSampler(locationObj,accelDirection);
    this.isGoal = false;
}

Node.prototype.expand = function() {
    this.cvs.sampleConnectivity();
    this.cvs.animateConnectivity();

    var connectedObjects = [];
    for(var i = 0; i < this.cvs.connectedNodeNames.length; i++)
    {
        connectedObjects.push(this.cvs.nameToObject[this.cvs.connectedNodeNames[i]]);
    }

    return connectedObjects;
}



function PartialPlan(parentPlan,node) {
    if(!parentPlan)
    {
        this.nodes = [];
    }
    else
    {
        this.nodes = parentPlan.nodes.slice(0);
    }

    this.nodes.push(node);

    var totalTime = 0;
    for(var i = 0; i < this.nodes.length - 1; i++)
    {
        //for every node -> node connection in our partial plan,
        //calculate the time and add it
        var sourceNode = this.nodes[i];
        var destNode = this.nodes[i+1];

        var name = destNode.locationName;

        var time = sourceNode.cvs.animationInfo[name].totalTime;
        console.log('found ',time,'between s',sourceNode,'and dest',destNode);

        totalTime += time;
    }

    this.totalTime = totalTime;
};


function GraphSearcher(initialConcaveVertex) {

    //the initial accel will just be negated sum of
    //the two edge outward normals, scaled to the length of the field
    //accel
    var iv = initialConcaveVertex;

    var gDirection = vecNormalize(vecAdd(iv.inEdge.outwardNormal,iv.outEdge.outwardNormal));
    var startAccel = vecScale(vecNegate(gDirection),vecLength(globalAccel));
    this.startAccel = startAccel;

    //this is the standard UCS. aka have a priority queue of partial plans, yadda
    //yadda yadda

    this.poppedPlans = [];
    this.planPriorityQueue = [];
    this.sortFunction = function(a,b) {
        return a.totalTime - b.totalTime;
    };

    var n = new Node(initialConcaveVertex,startAccel);
    var plan = new PartialPlan(null,n);

    this.planPriorityQueue.push(plan);
    this.planPriorityQueue.sort(this.sortFunction);

};

GraphSearcher.prototype.printPlan = function(plan) {
    var str = '';

    for(var i = 0; i < plan.nodes.length; i++)
    {
        var n = plan.nodes[i];
        str = str + node.locationName + '->';
    }

    console.log(str);
};

GraphSearcher.prototype.searchStep = function() {
    //pop off the top plan
    var planToExpand = this.planPriorityQueue.pop();

    this.poppedPlans.push(planToExpand);

    //expand this top node to get a bunch of other nodes
    var nodeToExpand = planToExpand.nodes[planToExpand.nodes.length - 1];

    if(!nodeToExpand)
    {
        //no solution found :(
        return "NoSolution";
    }


    if(nodeToExpand.isGoal)
    {
        this.solution = planToExpand;
        return "FoundSolution";
    }

    var newLocationObjects = nodeToExpand.expand();
    for(var i = 0; i < newLocationObjects.length; i++)
    {
        var newNode = new Node(newLocationObjects[i],this.startAccel);
        var newPlan = new PartialPlan(planToExpand,newNode);
        this.planPriorityQueue.push(newPlan);
    }

    //maintain the priorty queue
    this.planPriorityQueue.sort(this.sortFunction);

    //not at goal yet
    return "StillSearching";
};

GraphSearcher.prototype.search = function() {
    this.searchStepAsync();
};

GraphSearcher.prototype.searchStepAsync = function() {
    var results = this.searchStep();
    if(debug)
    {
        gs = this;
        console.log(this);
        return;
    }

    var poppedPlan = this.poppedPlans[this.poppedPlans.length - 1];

    if(results == "FoundSolution")
    {
        topNotify("Found a solution!");
        var that = this;

        setTimeout(function() {
            that.animateSolution();
        },3000);
    }
    else if(results == "NoSolution")
    {
        topNotify("No Solution Found");
    }
    else
    {
        var that = this;
        //TODO: make this take the time of the fastest one...
        setTimeout(function() {
            that.searchStepAsync();
        },500);
    }
};

GraphSearcher.prototype.animateSolution = function() {
    if(!this.solution)
    {
        throw new Error("no solution to animate!"); 
    }

    var nodes = this.solution.nodes;
    for(var i = 0; i < nodes.length - 1; i++)
    {
        var sourceNode = nodes[i];
        var destNode = nodes[i+1];
        var name = destNode.locationName;

        var animation = sourceNode.cvs.animationInfo[name];
        animation.particle.animate();
    }
};


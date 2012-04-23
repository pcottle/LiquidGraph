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
    //DEBUG / OPTIONAL -- animate connectivity
    //this.cvs.animateConnectivity();

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

    console.log("this is my plan");
    
    var totalTime = 0;
    for(var i = 0; i < this.nodes.length - 1; i++)
    {
        //for every node -> node connection in our partial plan,
        //calculate the time and add it
        var sourceNode = this.nodes[i];
        var destNode = this.nodes[i+1];

        var name = destNode.locationName;

        var time = sourceNode.cvs.animationInfo[name].totalTime;
        //console.log('found ',time,'between s',sourceNode,'and dest',destNode);

        totalTime += time;
    }
    
    this.totalTime = totalTime;
};

PartialPlan.prototype.lastNode = function() {
    return this.nodes[this.nodes.length - 1];
};


function GraphSearcher(initialConcaveVertex) {

    //the initial accel will just be negated sum of
    //the two edge outward normals, scaled to the length of the field
    //accel
    var iv = initialConcaveVertex;

    var gDirection = vecNormalize(vecAdd(iv.inEdge.outwardNormal,iv.outEdge.outwardNormal));
    var startAccel = vecScale(vecNegate(gDirection),vecLength(globalAccel));
    this.startAccel = startAccel;

    //this is the standard UCS. aka have a priority queue of partial plans,
    //a closed set for visited graphs, etc.

    this.poppedPlans = [];
    this.visitedStates = {};
    
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

    console.log("THIS PLAN IS:");
    
    for(var i = 0; i < plan.nodes.length; i++)
    {
        var n = plan.nodes[i];
        str = str + n.locationName + '->';
    }

    console.log(str);
};

GraphSearcher.prototype.searchStep = function() {
    //pop off the top plan
    var planToExpand = this.planPriorityQueue.shift();

    var topNode = planToExpand.lastNode();
    var topNodeName = topNode.locationName;
    
    if(this.visitedStates[topNodeName])
    {
        //call ourselves when in async mode
        //this.searchStep();
        return;
    }
    this.visitedStates[topNodeName] = true;
    
    this.poppedPlans.push(planToExpand);
    this.printPlan(planToExpand);
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
        this.buildSolutionAnimation();

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

    var times = [];
    for(var i = 0; i < this.planPriorityQueue.length; i++)
    {
        times.push(this.planPriorityQueue[i].totalTime);
    }

    console.log("SORTED LIST OF TIMES IS");
    console.log(times.join(','));

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
        //console.log("Found a solution!");
        var _this = this;

        setTimeout(function() {
            _this.animateSolution();
        },3000);
    }
    else if(results == "NoSolution")
    {
        topNotify("No Solution Found");
    }
    else
    {
        var _this = this;
        var f = function() {
            _this.searchStepAsync();
        };
        bAnimator.add(f);
    }
};

GraphSearcher.prototype.buildSolutionAnimation = function() {
    //ok so this is the deal. we need to build a ton of functions that will animate
    //between two arbitrary things. these are the types of functions we will have:

    // gravityTransition:
    //      animates between two different gravity directions. useful for
    //      the initial transition and when "rotating" the board with a
    //      trapped particle

    // gravityParticleTransition:
    //      this one is kinda intense. we will animate a gravity transition WHILE
    //      animating a particle.

    // particleAnimation:
    //
    //      this one is easy. just take two nodes in our plan solution,
    //      get the transition particle, and animate that sucker.


};

GraphSearcher.prototype.animateSolution = function() {
    if(!this.solution)
    {
        throw new Error("no solution to animate!"); 
    }
    partController.clearAll();

    this.animateStep();
};

GraphSearcher.prototype.animateStep = function() {

    if(connectionToAnimate >= this.solution.nodes.length -1)
    {
        //we are done!
        return;
    }
    var i = connectionToAnimate;

    var nodes = this.solution.nodes;
    var sourceNode = nodes[i];
    var destNode = nodes[i+1];
    var name = destNode.locationName;

    var animation = sourceNode.cvs.animationInfo[name];

    //ok we would like to animate this particle and then have it call ourselves
    //when it's done

    var _this = this;
    var done = function() {
        _this.animateStep(i+1);
    };

    animation.particle.animate(done);
};


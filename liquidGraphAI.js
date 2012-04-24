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

    console.log("This plan is:");
    
    for(var i = 0; i < plan.nodes.length; i++)
    {
        var n = plan.nodes[i];
        str = str + n.locationName;
        if(i < plan.nodes.length - 1)
        {
            str = str + '->';
        }
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

    //console.log("SORTED LIST OF TIMES IS");
    //console.log(times.join(','));

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

    // nodeNodeAnimation:
    //
    //      this one is easy. just take two nodes in our plan solution,
    //      get the transition particle, and animate that sucker.

    this.animateStepFunctions = [];

    //first, pop on a function that takes in the global accel and rotates to the starting accel

    var _this = this;
    var initialAccel = globalAccel;
    var lastG = globalAccel;

    var startPos = this.solution.nodes[0].cvs.concaveVertex;
    this.pBody = cuteSmallCircle(startPos.x,startPos.y);
    this.ring = p.circle(startPos.x,startPos.y,40,40);
    this.ring.attr({
        'stroke-width':5,
        'stroke':'rgba(255,255,255,0.5)',
        'fill':'rgba(0,0,0,0)'
    });

    //now loop through nodes
    for(var i = 0; i < this.solution.nodes.length -1; i++)
    {
        //get information
        var sourceNode = this.solution.nodes[i];
        var destNode = this.solution.nodes[i+1];
        var name = destNode.locationName;
        var animation = sourceNode.cvs.animationInfo[name];

        var startingG = animation.startG;
        var realEndG = animation.realEndAccel;
        var transParticle = animation.transParticle;

        var transPos = sourceNode.cvs.concaveVertex;
        var timeToTransition = animation.timeToTransition;

        var time = 15;
        if(i == 0) { time = time * 3; }

        var gravTransition = this.makeGravityClosure(transPos,lastG,startingG,time,i);

        //ok so to animate a solution, first transition between these gravity directions
        this.animateStepFunctions.push(gravTransition);

        //then animate between the startingG, the realEndG, WHILE animating the particle
        var gravParticleTransition = this.makeGravityParticleTransitionClosure(startingG,realEndG,
                                                        transParticle,timeToTransition);
        this.animateStepFunctions.push(gravParticleTransition);

        lastG = realEndG;

        //then animate the actual node node animation
        var particleAnimation = this.makeNodeNodeClosure(i);
        this.animateStepFunctions.push(particleAnimation);
    }

    //push one to return to our original position
    gravTransition = this.makeGravityClosure(null,lastG,initialAccel,time,"end");
    this.animateStepFunctions.push(gravTransition);
};

GraphSearcher.prototype.animateSolution = function() {
    if(!this.solution)
    {
        throw new Error("no solution to animate!"); 
    }
    partController.clearAll();

    solveController.isAnimating = true;

    solveController.UIbutton.hideAllButtons();

    this.animateStepNum = 0;

    this.animateStep();
};

GraphSearcher.prototype.animateStep = function() {
    if(this.animateStepNum >= this.animateStepFunctions.length)
    {
        //we are done, clean up after ourselves
        topNotifyClear();
        this.pBody.remove();
        this.ring.remove();

        solveController.UIbutton.anchorClick();
        solveController.UIbutton.showMainButtons();

        //also tell the solve UI that we are done
        solveController.isAnimating = false;

        partController.clearAll();

        return;
    }

    //animating!!
    this.animateStepFunctions[this.animateStepNum]();

    this.animateStepNum++;
};

GraphSearcher.prototype.makeGravityParticleTransitionClosure = function(startingG,realEndG,transParticle,timeToTransition) {
    var _this = this;
    var gravParticleTransition = function() {
        _this.gravityAnimation(null,startingG,realEndG,timeToTransition);
        transParticle.animate();
    };
    return gravParticleTransition;
};

GraphSearcher.prototype.makeGravityClosure = function(transPos,startG,endG,time,index) {

    var _this = this;
    
    var gravTransition = function() {
        //do a cross hair on the first
        if(index == 0)
        {
            _this.pBody.attr({
                r:200
            });
            _this.pBody.animate({
                r:4
            },4000,'easeIn');
        }

        _this.gravityAnimation(transPos,startG,endG,time);
    };
    return gravTransition;
};

GraphSearcher.prototype.gravityAnimation = function(transPos,gStart,gEnd,time) {
    if(transPos)
    {
        this.pBody.attr({
            cx:transPos.x,
            cy:transPos.y
        });
        this.ring.attr({
            cx:transPos.x,
            cy:transPos.y
        });
        this.ring.show();
        this.pBody.show();
    }

    var _this = this;
    var doneFunction = function() {
        _this.animateStep();
        _this.pBody.hide();
        _this.ring.hide();
    };

    var gt = new GravityTweener(gStart,gEnd,time,doneFunction);
    gt.start();
};

GraphSearcher.prototype.makeNodeNodeClosure = function(nodeIndex) {
    var _this = this;
    var particleAnimation = function() {
        _this.nodeNodeAnimation(nodeIndex);
    };
    return particleAnimation;
};

GraphSearcher.prototype.nodeNodeAnimation = function(nodeIndex) {

    if(nodeIndex >= this.solution.nodes.length -1)
    {
        console.warn("called particle animation for a node that didn't exist");
        //we are done!
        return;
    }

    var i = nodeIndex;

    var nodes = this.solution.nodes;
    var sourceNode = nodes[i];
    var destNode = nodes[i+1];
    var name = destNode.locationName;

    var animation = sourceNode.cvs.animationInfo[name];

    //ok we would like to animate this particle and then have it call ourselves
    //when it's done

    var _this = this;
    var done = function() {
        _this.animateStep();
    };

    animation.particle.animate(done,true);
    partController.add(animation.particle);
};


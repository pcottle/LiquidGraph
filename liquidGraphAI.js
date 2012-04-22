/*********** The file for all the AI work. It's ironic that the AI code will be only a few
             hundred lines, while all the physics / graphics / UI are huge.

                                                                                ********/


/********* Classes **********/

function Node(concaveVertex) {

    if(concaveVertex == 'offScreen')
    {
        this.isGoal = true;
        this.cvs = null;
        return;
    }

    this.cvs = new concaveVertexSampler(concaveVertex);
    this.isGoal = false;
}

Node.prototype.expand = function() {
    this.cvs.sampleConnectivity();
    this.cvs.animateConnectivity();

    return this.cvs.connectedNodes;
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

        var time = sourceNode.cvs.animationInfo[destNode.concaveVertex.id].totalTime;
        console.log('found ',time,'between s',sourceNode,'and dest',destNode);

        totalTime += time;
    }

    this.totalTime = totalTime;
};


function GraphSearcher(initalConcaveVertex) {

    //this is the standard UCS. aka have a priority queue of partial plans, yadda
    //yadda yadda

    this.planPriorityQueue = [];
    this.sortFunction = function(a,b) {
        return a.totalTime - b.totalTime;
    };

    var n = new Node(initialConcaveVertex);
    var plan = new PartialPlan(null,n);

    this.planPriorityQueue.push(plan);
    this.planPriorityQueue.sort(this.sortFunction);

};

GraphSearcher.prototype.searchStep = function() {
    //pop off the top plan
    var planToExpand = this.planPriorityQueue.pop();

    //expand this top node to get a bunch of other nodes
    var nodeToExpand = planToExpand.nodes[planToExpand.nodes.length - 1];

    if(nodeToExpand.isGoal)
    {
        return true;
    }

    var newLocationObjects = nodeToExpand.expand();
    for(var i = 0; i < newLocationObjects.length; i++)
    {
        var newNode = new Node(newLocationObjects[i]);
        var newPlan = new PartialPlan(planToExpand,newNode);
        this.planPriorityQueue.push(newPlan);
    }

    //maintain the priorty queue
    this.planPriorityQueue.sort(this.sortFunction);

    //not at goal yet
    return false;
};

GraphSearcher.prototype.search = function() {
    this.searchStepAsync();
};

GraphSeacher.prototype.searchStepAsync = function() {
    var results = this.searchStep();

    if(results)
    {
        topNotifyTemp("Found a solution!");
    }
    else
    {
        //TODO: make this take the time of the fastest one...
        setTimeout(function() {
            this.searchStepAsync();
        },500);
    }
};


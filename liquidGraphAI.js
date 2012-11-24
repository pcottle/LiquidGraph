/*********** The file for all the AI work. It's ironic that the AI code will be only a few
             hundred lines, while all the physics / graphics / UI are huge.

                                                                                ********/

/********* Classes **********/

function Node(locationObjs, accelDirection) {
  if (!accelDirection) { throw new Error("need field accel at this node!"); }

  this.locationObjs = locationObjs;
  this.isGoal = false;
  this.cvs = null;

  this.locationName = this.stringifyLocations(locationObjs);

  var matches = this.locationName.match(/offScreen/g);
  if (matches && matches.length == this.locationObjs.length) {
    this.isGoal = true;
  }


  if (!this.isGoal) {
    // TODO we need to pass in all the location objs...
    //console.log('the location objs are', locationObjs, 'for cvs');
    this.cvs = new ConcaveVertexSampler(locationObjs, accelDirection);
  }
}

Node.prototype.stringifyLocation = function(locationObj) {
  return (locationObj.id) ? String(locationObj.id) : 'offScreen';
};

Node.prototype.stringifyLocations = function(locationObjs) {
  var tupleEntries = [];
  _.each(locationObjs, function(locationObj) {
    // we are only the goal if ALL of our entries are offscreen
    tupleEntries.push(this.stringifyLocation(locationObj));
  }, this);

  tupleEntries.sort();

  return '(' + tupleEntries.join(',') + ')';
};

Node.prototype.getNumInSame = function() {
  var locationToNum = {};
  _.each(this.locationObjs, function(locationObj) {
    var hash = this.stringifyLocation(locationObj);
    locationToNum[hash] = locationToNum[hash] || 0;
    locationToNum[hash] += 1;
  }, this);

  var numInSame = 0;
  _.each(locationToNum, function(val) {
    if (val > 1) {
      numInSame += val;
    }
  });
  return numInSame;
};

Node.prototype.getNumOffScreen = function() {
  var results = this.locationName.match(/offScreen/g);
  if (!results) {
    return 0;
  } else {
    return results.length;
  }
};

Node.prototype.expand = function() {
  this.cvs.sampleConnectivity();
  //DEBUG / OPTIONAL -- animate connectivity
  //this.cvs.animateConnectivity();

  var connectedObjects = [];
  _.each(this.cvs.getNameToLocations(), function(locationObjs, locationName) {
    connectedObjects.push(locationObjs);
  }, this);

  // console.log('THESE CONNECTED ojects', connectedObjects);

  return connectedObjects;
}

function PartialPlan(parentPlan,node) {
  // if no parent plan, then we start with an empty array
  this.nodes = (parentPlan) ? parentPlan.nodes.slice(0) : [];

  this.nodes.push(node);

  this.totalTime = this.calculateTotalTime(this.nodes);
}

PartialPlan.prototype.calculateTotalTime = function(nodes) {
  var totalTime = 0;

  for (var i = 0; i < nodes.length - 1; i++) {
    //for every node -> node connection in our partial plan,
    //calculate the time and add it
    var sourceNode = nodes[i];
    var destNode = nodes[i+1];

    var name = destNode.locationName;
    // LOL oh shit, its actually not this, because we need to the tweener time
    // and time for the action as well. hmm.. TODO
    var time = sourceNode.cvs.getConnectivity()[name].time;

    totalTime += time;
  }

  return totalTime;
};

PartialPlan.prototype.getNumInSame = function() {
  return this.lastNode().getNumInSame();
};

PartialPlan.prototype.getNumOffScreen = function() {
  return this.lastNode().getNumOffScreen();
};

PartialPlan.prototype.lastNode = function() {
  return this.nodes[this.nodes.length - 1];
};

function GraphSearcher(concaveVertices) {
  //the initial accel will just be negated sum of
  //the two edge outward normals, scaled to the length of the field
  //accel
  var iv = concaveVertices[0];

  // TODO -- starting acceleration calculation revamp. needs to be some average of all of these
  // nodes.... hmm ? maybe not
  var gDirection = vecNormalize(vecAdd(iv.inEdge.outwardNormal,iv.outEdge.outwardNormal));
  var startAccel = vecScale(vecNegate(gDirection),vecLength(globalAccel));
  this.startAccel = startAccel;

  //this is the standard UCS. aka have a priority queue of partial plans,
  //a closed set for visited graphs, etc.

  this.poppedPlans = [];
  this.goalPlans = [];
  this.visitedStates = {};

  this.planPriorityQueue = [];
  this.sortFunction = function(a,b) {
    // ok so this is more complicated -- we need to sort first by our heuristics essentially
    var aOff = a.getNumOffScreen();
    var bOff = b.getNumOffScreen();
    if (aOff !== bOff) {
      return bOff - aOff;
    }

    var aSame = a.getNumInSame();
    var bSame = b.getNumInSame();
    if (aSame !== bSame) {
      return bSame - aSame;
    }

    return a.totalTime - b.totalTime;
  };

  var n = new Node(concaveVertices,startAccel);
  var plan = new PartialPlan(null, n);

  this.planPriorityQueue.push(plan);
  this.planPriorityQueue.sort(this.sortFunction);
};

GraphSearcher.prototype.printPlan = function(plan) {
  var str = '';
  _.each(plan.nodes, function(n, i) {
    str += n.locationName
    str += (i < plan.nodes.length - 1) ? '->' : '';
  });

  console.log("This plan is: ", str);
};

GraphSearcher.prototype.searchStep = function() {
    //pop off the top plan
    var planToExpand = this.planPriorityQueue.shift();

    console.log('the plan i popped or shifted was', planToExpand);
    if (planToExpand) {
      this.printPlan(planToExpand);
    }

    if (!planToExpand) {
      if (!WORST) {
        return "NoSolution";
      }

      console.log('trying to find worst solution because i exhausted all...');
      // see if we found any goal
      if (!this.goalPlans.length) {
        return "NoSolution";
      }
      this.solution = this.goalPlans.pop();
      this.buildSolutionAnimation();
      return "FoundSolution";
    }

    var topNodeName = planToExpand.lastNode().locationName;
    if (this.visitedStates[topNodeName]) {
      console.log('already visited state', topNodeName);
      return;
    }

    //expand this top node to get a bunch of other nodes
    var nodeToExpand = planToExpand.nodes[planToExpand.nodes.length - 1];

    // now we are actually expanding a plan from here
    this.poppedPlans.push(planToExpand);
    this.printPlan(planToExpand);

    if (nodeToExpand.isGoal) {
      if (!WORST) {
        this.solution = planToExpand;
        this.buildSolutionAnimation();
        return "FoundSolution";
      }
      // want to just add this
      this.goalPlans.push(planToExpand);
      this.goalPlans.sort(this.sortFunction);
      return;
    }
    this.visitedStates[topNodeName] = true;

    var newLocationObjects = nodeToExpand.expand();
    for (var i = 0; i < newLocationObjects.length; i++) {
        // TODO: all location objects??
        var newNode = new Node(newLocationObjects[i], this.startAccel);

        var newPlan = new PartialPlan(planToExpand,newNode);
        this.planPriorityQueue.push(newPlan);
    }

    //maintain the priorty queue
    this.planPriorityQueue.sort(this.sortFunction);
    if (WORST) {
      this.planPriorityQueue.reverse();
    }

    var times = [];
    for (var i = 0; i < this.planPriorityQueue.length; i++) {
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
    if (debug) {
      gs = this;
      console.log(this);
      return;
    }

    var poppedPlan = this.poppedPlans[this.poppedPlans.length - 1];

    if (results == "FoundSolution") {
      topNotify("Found a solution!");
      //console.log("Found a solution!");
      var _this = this;

      setTimeout(function() {
          _this.animateSolution();
      }, 3000);
    } else if (results == "NoSolution") {
      topNotify("No Solution Found");
      partController.clearAll();
    } else {
      var _this = this;
      var f = function() {
          _this.searchStepAsync();
      };
      bAnimator.add(f);
    }
};

GraphSearcher.prototype.buildSolutionAnimation = function() {
    var time = 15;
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

    // ugh, ideally we would have a ring that is just consistent through all animations,
    // but since there are a bunch of different kinetic paths all joining up together,
    // its a lot of work to refactor that...
    this.rings = [];
    this.pBodies = [];
    GLOBAL_RINGS = this.rings;
    GLOBAL_PBODIES = this.pBodies;

    _.each(this.solution.nodes[0].cvs.concaveVertices, function(cv) {
      var ring = p.circle(cv.x, cv.y, 40, 40);
      ring.attr({
        'stroke-width':5,
        'stroke':'rgba(255,255,255,0.5)',
        'fill':'rgba(0,0,0,0)'
      });

      var pBody = cuteSmallCircle(cv.x, cv.y);

      this.rings.push(ring);
      this.pBodies.push(pBody);
    }, this);

    //now loop through nodes
    for (var i = 0; i < this.solution.nodes.length -1; i++) {
      //get information
      var sourceNode = this.solution.nodes[i];
      var destNode = this.solution.nodes[i+1];
      var name = destNode.locationName;

      // go get the action for this jump and vectors
      var actionResults = sourceNode.cvs.getConnectivity()[name].actionResults;
      var startingG = actionResults.action.startG;
      var realEndG = actionResults.calcRealEndG();

      if (false && debug2) {
        var debugPos = {x: 400, y: 100 + i * 60};
        var a = new rArrow(debugPos, vecScale(realEndG, 200));
        a.path.click((function(action) {
          var toDebug = JSON.parse(JSON.stringify(action));
          return function() {
            console.log(toDebug);
          };
        })(actionResults.action));
      }

      //ok so to animate a solution, first transition between these gravity directions
      var gravTransition = this.makeGravityClosure(lastG,startingG,time,i, actionResults.getStartLocationObjs());
      this.animateStepFunctions.push(gravTransition);

      //then animate between the startingG, the realEndG, WHILE animating the particle
      var transAnimations = actionResults.getTransAnimations();
      var gravParticleTransition = this.makeGravityParticleTransitionClosure(startingG,realEndG,transAnimations);
      this.animateStepFunctions.push(gravParticleTransition);

      //then animate the actual node node animation
      var particleAnimation = this.makeNodeNodeClosure(i);
      this.animateStepFunctions.push(particleAnimation);

      // switch off for the next loop
      lastG = realEndG;
    }

    //push one to return to our original position
    gravTransition = this.makeGravityClosure(lastG,initialAccel,time,"end");
    this.animateStepFunctions.push(gravTransition);
};

GraphSearcher.prototype.animateSolution = function() {
  if (!this.solution) {
      throw new Error("no solution to animate!");
  }
  partController.clearAll();

  solveController.isAnimating = true;

  solveController.UIbutton.hideAllButtons();

  this.animateStepNum = 0;

  this.animateStep();
};

GraphSearcher.prototype.finishAnimation = function() {
  //we are done, clean up after ourselves
  topNotifyClear();
  _.each(this.pBodies, function(pbody) { pbody.remove(); });
  _.each(this.rings, function(ring) { ring.remove(); });
  GLOBAL_RINGS = [];
  GLOBAL_PBODIES =[];

  solveController.searchFinished();
  solveController.UIbutton.anchorClick();
  solveController.UIbutton.showMainButtons();

  //also tell the solve UI that we are done
  solveController.isAnimating = false;

  partController.clearAll();

  //if this is the demo, keep solving for a bit
  if (/demo/.test(location.href)) {
    solveController.UIbutton.anchorClick();
  }
};


GraphSearcher.prototype.animateStep = function() {
  if (this.animateStepNum >= this.animateStepFunctions.length) {
    this.finishAnimation();
    return;
  }

  //animating!!
  this.animateStepFunctions[this.animateStepNum]();
  this.animateStepNum++;
};

GraphSearcher.prototype.makeGravityParticleTransitionClosure = function(startingG,realEndG,transAnimations) {
  var timeToTransition = 0;
  _.each(transAnimations, function(animation) {
    timeToTransition = Math.max(timeToTransition, animation.timeToTransition);
  }, this);

  var gravParticleTransition = _.bind(function() {
    this.gravityAnimation(startingG,realEndG,timeToTransition);

    _.each(transAnimations, function(transAnimation) {
      transAnimation.transParticle.animate();
    }, this);
  }, this);
  return gravParticleTransition;
};

GraphSearcher.prototype.makeGravityClosure = function(startG,endG,time,index, particlePositions) {
  // first one is slower?
  if (index == 0) { time = time * 1.5; }

  var gravTransition = _.bind(function() {
    //do a big zoom in on the first
    if (index == 0) {
      _.each(this.pBodies, function(pBody) {
        pBody.attr({
            r:200
        });
        pBody.animate({
            r:4
        },1000,'easeIn');
      }, this);
    }

    this.gravityAnimation(startG,endG,time, particlePositions);
  }, this);
  return gravTransition;
};

GraphSearcher.prototype.gravityAnimation = function(gStart,gEnd,time, particlePositions) {
  if (particlePositions) {
    _.each(particlePositions, function(particlePos, i) {
      if (particlePos.x === undefined) {
        // it's offscreen
        return;
      }

      var ring = this.rings[i];
      var pBody = this.pBodies[i];

      ring.attr({
        cx: particlePos.x,
        cy: particlePos.y
      });
      ring.show();
      pBody.attr({
        cx: particlePos.x,
        cy: particlePos.y
      });
      pBody.show();
    }, this);
  }

  var doneFunction = _.bind(function() {
    this.animateStep();
  }, this);

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
  if (nodeIndex >= this.solution.nodes.length -1) {
    console.warn("called particle animation for a node that didn't exist");
    //we are done!
    return;
  }

  var i = nodeIndex;
  var nodes = this.solution.nodes;
  var sourceNode = nodes[i];
  var destNode = nodes[i+1];
  var name = destNode.locationName;

  var maxTimeForSettle = sourceNode.cvs.getConnectivity()[name].time;
  var actionResults = sourceNode.cvs.getConnectivity()[name].actionResults;
  var settleAnimations = actionResults.getSettleAnimations();

  var foundMax = false;
  whenLastDone = _.bind(function() {
    this.animateStep();
  }, this);

  _.each(settleAnimations, function(animation, index) {
    if (!foundMax && animation.time == maxTimeForSettle) {
      foundMax = true;
      animation.particle.animate(whenLastDone, true);
    } else {
      animation.particle.animate(function() {}, true);
    }
    partController.add(animation.particle);
  }, this);
};


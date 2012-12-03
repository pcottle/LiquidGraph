$j = jQuery.noConflict();
var debug2 = true;

//globals
var notifyTimeout = null;
var p = null;

var polygonInsertControl = null;
var polyController = null;

var debug = false;
var WORST = false; // go for the longest plans
var NUM_SAMPLE = 0;
var NUM_SAMPLE_REJECTED = 0;
var LAST_SOLVED = null;

var GLOBAL_RINGS = null;
var GLOBAL_PBODIES = null;

function globalCrossHide(index) {
  GLOBAL_RINGS[index].hide();
  GLOBAL_PBODIES[index].hide();
}

function globalCrossShow(index) {
  GLOBAL_RINGS[index].show();
  GLOBAL_PBODIES[index].show();
}

function showDemoDiv() {
    $j('#demoWrapper').css('top','100px');
}

function hideDemoDiv() {
    $j('#demoWrapper').css('top','-600px');
}

function loadIdsAndSolve(ids) {
  if (!ids) {
    ids = (DEMO_VERTEX_ID) ? [DEMO_VERTEX_ID] : DEMO_VERTEX_IDS;
  }

  var vertices = [];
  _.each(ids, function(id) {
    var v = polyController.getVertexById(id);
    vertices.push(v);

    var circle = cuteSmallCircle(v.x,v.y);
    circle.attr({
        r:200
    });
    circle.animate({
        r:4
    },1000,'easeInOut');
  });

  topNotifyTemp("Looking for solution here",2000);

  solveController.searchOn();
  setTimeout(function() {
    searcher = new GraphSearcher(vertices);
    searcher.search();
  },1000);
}

function turnSolveControllerOn() {
  //hack up the solve mode
  solveController.active = true;
  solveController.UIbutton.active = true;
  solveController.UIbutton.hideAllButtons();
}

function executeDemo() {
  hideDemoDiv();
  windowResize();
  startLoading();
  setTimeout(function() {
    stopLoading();
    importGeometry();
    toggleImportExport();

    turnSolveControllerOn();

    loadIdsAndSolve();
  },200);
}

function startLoadingWithText(theText) {
  startLoading();
  topNotify(theText);
}

function stopLoadingWithText() {
    stopLoading();
    topNotifyClear();
}

function topNotifyClear() {
    $j('#topNotifyBar').html('');
    $j('#topNotifyBarHolder').addClass('topNotifyBarHidden');
    if(notifyTimeout) { clearTimeout(notifyTimeout); }
}

function startLoading() {
    isLoading = true;

    var wHeight = $j(window).height();
    var wWidth = $j(window).width();
    $j('.loadingGif').css('left',String(wWidth/2 - 220*0.5) + 'px');
    $j('.loadingGif').css('top',String(wHeight / 2 - 19*0.5) + 'px');
    $j('.loadingGif').fadeIn();
}

function stopLoading() {
    isLoading = false;
    $j('.loadingGif').fadeOut();
}


function topNotify(theText) {
    topNotifyHtml('<h2 style="font-size:40px">' + theText + "</h2>");
}

function topNotifyTemp(theText,time) {
    if(!time) { time = 3000; }
    topNotify(theText);
    notifyTimeout = setTimeout('topNotifyClear();',time);
}

function topNotifyHtml(theText) {
    //and if someone is clicking fast, get rid of it
    if(notifyTimeout)
    {
        clearTimeout(notifyTimeout);
    }

    //basically, if its already displayed, hide it and come back in 700ms
    if(!$j('#topNotifyBarHolder').hasClass('topNotifyBarHidden'))
    {
        //clear and come back
        topNotifyClear();
        var jsToExecute = "topNotifyHtml('" + theText + "');";
        notifyTimeout = setTimeout(jsToExecute,700);
        return;
    }

    $j('#topNotifyBar').html("<h1>" + theText + "</h1>");

    $j('#topNotifyBarHolder').removeClass('topNotifyBarHidden');
}

$j(document).ready(function(){

    startLoading();
    setTimeout(function() {
        stopLoading();
    },1000);
    p = Raphael("canvasHolder");

    polygonInserter = new polygonUIControl();
    polyController = new polygonController();
    partController = new particleController();
    particleTracer = new TraceUIControl();
    polyEditor = new EditUIControl();
    solveController = new SolveUIControl();
    bAnimator = new BulkAnimator();
    gArrow = false;

    $j(window).resize(windowResize);

    //get the hidden svg later for rotation
    rotationLayer = $j('svg')[0];
    rotationLayerRad = 0;
    $j(rotationLayer).css('-webkit-transform','rotate3d(0,0,1,0rad)');

    if(!/WebKit/.test(window.navigator.userAgent) && !/Firefox/.test(window.navigator.userAgent))
    {
        alert("Oh no! This application uses -webkit-transform to animate the final solutions, which your browser doesn't seem to support. Everything will still work, but during the solution animation, you'll have to look at the gravity arrow in the corner that I coded just for you instead of having the part rotate in an intuitive manner.");
        gArrow = new GravityArrow();
    }

    if(/demo/.test(location.href)) {
      showDemoDiv();
      solveController.UIbutton.hideAllButtons();
      $j('#demoButton').slideDown();
      return;
    }

    if (/geometry=/.test(location.href)) {
      // get the string in a hacky way
      var href = location.href;
      var escaped = href.split('geometry=')[1];
      escaped = escaped.split('&')[0];
      var json = unescape(escaped);
      importGeometry(json);
      toggleImportExport();
      // do thing for particles

      if (/idsToSolve=/.test(location.href)) {
        href = location.href;
        var listEscaped = href.split('idsToSolve=')[1];
        listEscaped = listEscaped.split('&')[0];
        var list = JSON.parse(unescape(listEscaped));

        loadIdsAndSolve(list);
        turnSolveControllerOn();
      }
    }
});



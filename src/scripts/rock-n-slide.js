// Load dependencies in parameter
export var rockNslide = (function(){
  // CONFIG and VARIABLES
  const DEFAULT_CONFIG = {
    speed: 400,
    animationType: 'easeInOutQuad',
    lazyLoad: true,
    help: true,
    classList: {
      slidesWrapper:     "frame",
      slide:             "slide",
      menuTrigger:       "menu-nav__trigger",
      menuTriggerActive: "menu-nav__trigger--active",
      menuSlide:         "slide--menu",
      menuSlideActive:   "slide--menu-active",
      menuItem:          "menu__nav-anchor",
      scrollText:        "slide__scrolling-text"
    }
  };
  let CONFIG = {};
  let animationInProgress = false;
  let elemsWithGradients = [];
  let dependency = {};
  let isMenuOpen = false;
  let slides = [];
  let slidesWrapper;
  let mobileMenuTrigger;
  let mobileMenu;
  let menuItem;
  let scrollText;

  // Check dependencies
  let checkDependencies = function(){
    if(dependency.animateScroll == null || dependency.animateScroll == undefined){
      dependency.animateScroll = false;
      if(CONFIG.help == true){
        console.info("rockNslide: AnimationScroll is missing \n"+
          "Disabling sliding animations.");
      }
    }
    if(dependency.waypoints == null || dependency.waypoints == undefined){
      dependency.waypoints = false;
      CONFIG.lazyLoad = false;
      if(CONFIG.help == true){
        console.info("rockNslide: Waypoint is missing \n"+
          "Disabling lazy load.");
      }
    }
    if(dependency.gradientMaps == null || dependency.gradientMaps == undefined){
      dependency.gradientMaps = false;
      if(CONFIG.help == true){
        console.info("rockNslide: GradientMaps is missing \n"+
          "Disabling gradient maps.");
      }
    }
  }

  // Helpers
  let getOffsetY = function(){
    return window.scrollY || window.pageYOffset
  };

  let generateSlides = function() {
    let slidesWrapper = document.getElementsByClassName(CONFIG.classList.slidesWrapper)[0];
    let slides = slidesWrapper.getElementsByClassName(CONFIG.classList.slide);

    assignSnapValues();
    applyGradientMaps(slidesWrapper);
  }

  let generateDOMReferences = function() {
    slidesWrapper = document.getElementsByClassName(CONFIG.classList.slidesWrapper)[0];
    mobileMenuTrigger = document.getElementsByClassName(CONFIG.classList.menuTrigger)[0];
    mobileMenu = document.getElementsByClassName(CONFIG.classList.menuSlide)[0];
    menuItem = document.getElementsByClassName(CONFIG.classList.menuItem);
    scrollText = document.getElementsByClassName(CONFIG.classList.scrollText)[0];
  }

  let assignSnapValues = function() {
    if(dependency.waypoints){
      for(let i = 0; i < slides.length; i++){
        new Waypoint({
          element: slides[i],
          handler: lazyImage,
          offset: '200%'
        })
      }
    }
  }

  let applyGradientMaps = function(wrapper) {
    if(dependency.gradientMaps){
      let elemsWithGradients = wrapper.querySelectorAll('[data-gradient]');
      for (var elem = 0; elem < elemsWithGradients.length; elem++) {
        const gradient = elemsWithGradients[elem].getAttribute('data-gradient');
        GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
      }
    }
  }

  let calculateNearestSlide = function(dir) {
    let documentHeight = document.body.clientHeight;
    let windowHeight = window.innerHeight;
    let offsetTop = getOffsetY();
    const passSlides = Math.round(offsetTop / windowHeight);
    const currentSlide = slides[passSlides];

    switch (dir) {
      case "up":
        return offsetTop <= windowHeight / 2 ?
          currentSlide : slides[passSlides - 1]
      case "down":
        return offsetTop >= documentHeight - (windowHeight * 1.5) ?
          currentSlide : slides[passSlides + 1]
      default:
        return currentSlide;
    }
  };

  // Sliding
  let slideTo = function(dir) {
    if (animationInProgress) {
      return;
    }
    animationInProgress = true;
    animateScroll(calculateNearestSlide(dir), 400, 'easeInOutQuad', 0, 0, function () {
      animationInProgress = false;
    });
  }

  // showMenu
  let toggleMobileMenu = function() {
    isMenuOpen = !isMenuOpen;
    mobileMenuTrigger.classList.toggle(CONFIG.classList.menuTriggerActive);
    mobileMenu.classList.toggle(CONFIG.classList.menuSlideActive);
    if(body.style.overflow == "hidden") {
      body.style.overflow = "";
    } else {
      body.style.overflow = "hidden";
    }
  };

  // scrollToTop
  let scrollToTop = function() {
    if (animationInProgress) {
      return;
    }
    animationInProgress = true;
    animateScroll(slides[0], CONFIG.speed, CONFIG.animationType, 0, 0, function () {
      animationInProgress = false;
    })
  }

  // prevSlide
  let prevSlide = function() {
    slideTo("up")
  };

  // nextSlide
  let nextSlide = function() {
    slideTo("down")
  };

  // Watchers
  let initWatchers = function() {
    if(CONFIG.lazyLoad){
      window.onresize = () => {
        assignSnapValues();
      }
    }
  }

  // Initialization
  // externalStuff should be an object containing
  // animateScroll, Waypoints and GradientMaps
  let init = function(config, externalStuff) {
    CONFIG = Object.assign({}, DEFAULT_CONFIG, config);
    dependency = externalStuff;
    checkDependencies();
    initWatchers();
    generateDOMReferences();
    generateSlides();
  };

  return {
    scrollToTop: scrollToTop,
    prevSlide: prevSlide,
    nextSlide: nextSlide,
    toggleMenu: toggleMobileMenu,
    init: init
  }
})();

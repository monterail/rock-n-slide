// Load dependencies in parameter
export var rockNslide = (function(animateScroll, GradientMaps, Waypoint){
  // CONFIG and VARIABLES
  const DEFAULT_CONFIG = {
    speed: 400,
    animationType: 'easeInOutQuad',
    lazyLoad: true,
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
  let slidesWrapper;
  let slides = [];
  let elemsWithGradients = [];

  // Check dependencies
  let checkDependencies = function(){
    console.log(animateScroll, GradientMaps, Waypoint);
    console.log('checkDependencies');
  }

  // Helpers
  let getOffsetY = function(){
    return window.scrollY || window.pageYOffset
  };

  let generateSlides = function(){
    let slidesWrapper = document.getElementsByClassName(CONFIG.classList.slidesWrapper)[0];
    let slides = slidesWrapper.getElementsByClassName(CONFIG.classList.slide);
  }

  let assignSnapValues = function(){
    for(let i = 0; i < slides.length; i++){
      new Waypoint({
        element: slides[i],
        handler: lazyImage,
        offset: '200%'
      })
    }
  }

  let applyGradientMaps = function() {
    let elemsWithGradients = slidesWrapper.querySelectorAll('[data-gradient]');
    for (var elem = 0; elem < elemsWithGradients.length; elem++) {
      const gradient = elemsWithGradients[elem].getAttribute('data-gradient');
      GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
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

  // scrollToTop
  let scrollToTop = function(){
    if (animationInProgress) {
      return;
    }
    animationInProgress = true;
    animateScroll(slides[0], CONFIG.speed, CONFIG.animationType, 0, 0, function () {
      animationInProgress = false;
    })
  }

  // prevSlide
  let prevSlide = slideTo("up")

  // nextSlide
  let nextSlide = slideTo("down")

  // Watchers
  if(CONFIG.lazyLoad){
    window.onresize = () => {
      assignSnapValues();
    }
  }

  // Initialization
  let init = function(config){
    CONFIG = Object.assign({}, DEFAULT_CONFIG, config);
    checkDependencies();
    generateSlides();
  };

  return {
    scrollToTop: scrollToTop,
    prevSlide: prevSlide,
    nextSlide: nextSlide,
    toggleMenu: "toggleMenu",
    init: init
  }
})();

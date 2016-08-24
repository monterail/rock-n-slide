require('./vendor/gradientmaps.min.js'); // Generator of gradientmap
var animateScroll = require('./vendor/animatescroll.min.js'); // Pure JS animate scroll
require('waypoints'); // Waypoints for lazy load animations
require('./mobile-menu.js');
require('./common.js');

// Mobile
var body = document.getElementsByTagName('body')[0],
bodyBorder = Number(window.getComputedStyle(body, ':after').getPropertyValue('height').replace(/px$/, '')),
scrollText = document.getElementsByClassName('slide__scrolling-text')[0],
windowHeight = window.innerHeight,
documentHeight = window.innerHeight,
offsetTop,
slideIndex = 0;

var getOffsetY = function(){
  return window.scrollY || window.pageYOffset;
};

var toggleVisibility = function(elem) {
  if (typeof elem !== "undefined" && elem !== null) {
    elem.style.opacity = getOffsetY() > 0 ? 0 : 1;
  }
};

var lazyImage = function(){
  var backgroundImage = this.element.getElementsByClassName('slide-background__image')[0];
  if(backgroundImage){
    var newAttributes = backgroundImage.getAttribute('style') +
      " " +
      backgroundImage.getAttribute('data-style');
    backgroundImage.setAttribute('style', newAttributes);
    backgroundImage.removeAttribute('data-style');
  }
};

function assignSnapVariables (){
  var frame = document.getElementsByClassName('frame')[0],
  slides = frame.getElementsByClassName('slide');
  for(var i = 0; i < slides.length; i++){
    new Waypoint({
      element: slides[i],
      handler: lazyImage,
      offset: '200%'
    })
  };
}
assignSnapVariables();

var calculateNearestSlide = function(dir){
  var passSlides = Math.round(offsetTop / windowHeight),
  currentSlide = slides[passSlides];

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

window.onscroll = function(){
  toggleVisibility(scrollText);
};

window.onresize = function(){
  assignSnapVariables();
}

window.onkeydown = function(e){
  documentHeight = document.body.clientHeight,
  windowHeight = window.innerHeight,
  offsetTop = getOffsetY();
  if(e.keyCode == 38){
    e.preventDefault();
    animateScroll(calculateNearestSlide("up"), 400, 'easeInQuad');
  }else if(e.keyCode == 40 || e.keyCode == 32){
    e.preventDefault();
    animateScroll(calculateNearestSlide("down"), 400, 'easeInQuad');
  }
};

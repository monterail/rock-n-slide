require('./gradientmaps.min.js'); // Generator of gradientmap
var animateScroll = require('./animatescroll.min.js'); // Pure JS animate scroll
require('waypoints'); // Waypoints for lazy load animations

// Is it IE?
(function(){
  var ieRegex = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
  if(ieRegex.exec(navigator.userAgent) != null){
    body.classList.add('ie');
  }
})();

// Mobile
var body = document.getElementsByTagName('body')[0],
bodyBorder = Number(window.getComputedStyle(body, ':after').getPropertyValue('height').replace(/px$/, '')),
mobileMenuTrigger = document.getElementsByClassName('menu-nav__trigger')[0],
mobileMenu = document.getElementsByClassName('slide--menu')[0],
scrollText = document.getElementsByClassName('slide__scrolling-text')[0],
menuItem = document.getElementsByClassName('mobile__menu-anchor'),
windowHeight = window.innerHeight,
documentHeight = window.innerHeight,
offsetTop,
isMenuOpen = false,
slideIndex = 0;

// Add target=_blank to all links except menu links generated from json
var links = document.getElementsByTagName('a');
for (var elem = 0; elem < links.length; elem++) {
  if (!links[elem].classList.contains('mobile__menu-anchor'))
    links[elem].setAttribute('target', '_blank');
}

var toggleVisibility = function(elem) {
  if (typeof elem !== "undefined" && elem !== null) {
    elem.style.opacity = getOffsetY() > 0 ? 0 : 1;
  }
};

var toggleMobileMenu = function() {
  isMenuOpen = !isMenuOpen;
  mobileMenuTrigger.classList.toggle('mobile-menu__trigger--active');
  mobileMenu.classList.toggle('slide--menu-active');
  toggleVisibility(scrollText);
  body.classList.toggle('overflow--hide');
};

mobileMenuTrigger.addEventListener('click', function(e){
  e.preventDefault();
  toggleMobileMenu();
});

for (var i = 0; i < menuItem.length; i++) {
  menuItem[i].addEventListener('click', toggleMobileMenu);
}

var getOffsetY = function(){
  return window.scrollY || window.pageYOffset;
}

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

var frame, slides;
function assignSnapVariables (){
  frame = document.getElementsByClassName('frame')[0];
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

// Apply Gradient Maps
var elemsWithGradients = document.querySelectorAll('[data-gradient]');
for (var elem = 0; elem < elemsWithGradients.length; elem++) {
  var gradient = elemsWithGradients[elem].getAttribute('data-gradient');
  GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
}
toggleVisibility(scrollText);

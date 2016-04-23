require('./gradientmaps.min.js');
var animateScroll = require('./animatescroll.min.js');
require('waypoints');

// Is it IE?
(function(){
  var ieRegex = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
  if(ieRegex.exec(navigator.userAgent) != null){
    body.classList.add('ie');
  }
})();

// Mobile
var body = document.getElementsByTagName('body')[0],
mobileMenuTrigger = document.getElementsByClassName('mobile-menu__trigger')[0],
mobileMenu = document.getElementsByClassName('slide--menu')[0],
scrollText = document.getElementsByClassName('slide__scrolling-text')[0],
menuItem = document.getElementsByClassName('mobile__menu-anchor'),

isMenuOpen = false,
slideIndex = 0;

// Add target=_blank to all links except menu links
// Find way to do it inside markdown
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
    var newAttributes = backgroundImage.getAttribute('style')+" "+ backgroundImage.getAttribute('data-style');
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

function calculateNearestSlide(dir) {
  var windowHeight = window.innerHeight - 50,
  value = Math.round(getOffsetY() / windowHeight) * windowHeight;
  switch (dir) {
    case "up":
      return Math.max(0, value - 1);
      break;
    case "down":
      return Math.min(value + 1, windowHeight);
      break;
    default:
      return value;
  }
};

window.onscroll = function(){
  toggleVisibility(scrollText);
};

window.onresize = function(){
  assignSnapVariables();
}

window.onkeydown = function(e){
  if(e.keyCode == 38){
    if(slideIndex < 1){
      return false;
    }
    animateScroll(slides[slideIndex-1], 400, 'easeInQuad');
  }else if(e.keyCode == 40 || e.keyCode == 32){
    if(slideIndex >= slides.length){
      return false;
    }
    animateScroll(slides[slideIndex+1], 400, 'easeInQuad');
  }
};

//Apply Gradient Maps
var elemsWithGradients = document.querySelectorAll('[data-gradient]');
for (var elem = 0; elem < elemsWithGradients.length; elem++) {
  var gradient = elemsWithGradients[elem].getAttribute('data-gradient');
  GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
}
toggleVisibility(scrollText);

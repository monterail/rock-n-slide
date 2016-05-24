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
menuNavTrigger = document.getElementsByClassName('menu-nav__trigger')[0],
navMenu = document.getElementsByClassName('slide--menu')[0],
scrollText = document.getElementsByClassName('slide__scrolling-text')[0],
menuItem = document.getElementsByClassName('menu__nav-anchor'),

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

var toggleNavMenu = function() {
  isMenuOpen = !isMenuOpen;
  menuNavTrigger.classList.toggle('menu-nav__trigger--active');
  navMenu.classList.toggle('slide--menu-active');
  toggleVisibility(scrollText);
  body.classList.toggle('overflow--hide');
};

menuNavTrigger.addEventListener('click', function(e){
  e.preventDefault();
  toggleNavMenu();
});

for (var i = 0; i < menuItem.length; i++) {
  menuItem[i].addEventListener('click', toggleNavMenu);
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

window.calculateNearestSlide = function(dir){
  // There is something wrong with calculating after passing dir
  var windowHeight = window.innerHeight - 50,
  passSlides = Math.round(getOffsetY() / windowHeight),
  nearest = Math.round(getOffsetY() / windowHeight) * windowHeight;
  switch (dir) {
    case "up":
      console.log(getOffsetY() % windowHeight);
      if(getOffsetY() % windowHeight > windowHeight/2){
        return Math.max(0, (passSlides - 1) * windowHeight);
      }else{
        return nearest;
      }
    case "down":
      if(getOffsetY() % windowHeight > windowHeight/2){
        return Math.min((passSlides + 1) * windowHeight, windowHeight);
      }else{
        return nearest;
      }
    default:
      return nearest;
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
    animateScroll(calculateNearestSlide("up"), 400, 'easeInQuad');
  }else if(e.keyCode == 40 || e.keyCode == 32){
    if(slideIndex >= slides.length){
      return false;
    }
    animateScroll(calculateNearestSlide("down"), 400, 'easeInQuad');
  }
};

//Apply Gradient Maps
var elemsWithGradients = document.querySelectorAll('[data-gradient]');
for (var elem = 0; elem < elemsWithGradients.length; elem++) {
  var gradient = elemsWithGradients[elem].getAttribute('data-gradient');
  GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
}
toggleVisibility(scrollText);

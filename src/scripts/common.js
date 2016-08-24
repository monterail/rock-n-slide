require('./vendor/gradientmaps.min.js'); // Generator of gradientmap

var scrollText = document.getElementsByClassName('slide__scrolling-text')[0];

// Is it IE?
(function(){
  var ieRegex = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
  if(ieRegex.exec(navigator.userAgent) != null){
    body.classList.add('ie');
  }
})();

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

var getOffsetY = function(){
  return window.scrollY || window.pageYOffset;
}

// Apply Gradient Maps
var elemsWithGradients = document.querySelectorAll('[data-gradient]');
for (var elem = 0; elem < elemsWithGradients.length; elem++) {
  var gradient = elemsWithGradients[elem].getAttribute('data-gradient');
  GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
}
toggleVisibility(scrollText);

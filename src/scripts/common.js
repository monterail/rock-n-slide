require('./vendor/gradientmaps.min.js'); // Generator of gradientmap

const scrollText = document.getElementsByClassName('slide__scrolling-text')[0];
const body = document.getElementsByTagName('body')[0];

// Is it IE?
((() => {
  const ieRegex = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
  if(ieRegex.exec(navigator.userAgent) != null){
    body.classList.add('ie');
  }
}))();

// Add target=_blank to all links except menu links generated from json
const links = document.getElementsByTagName('a');
for (var elem = 0; elem < links.length; elem++) {
  if (!links[elem].classList.contains('menu__nav-anchor'))
    links[elem].setAttribute('target', '_blank');
}

export function toggleVisibility(elem) {
  if (typeof elem !== "undefined" && elem !== null) {
    elem.style.opacity = getOffsetY() > 0 ? 0 : 1;
  }
};

export function getOffsetY() { return window.scrollY || window.pageYOffset };

// Apply Gradient Maps
const elemsWithGradients = document.querySelectorAll('[data-gradient]');
for (var elem = 0; elem < elemsWithGradients.length; elem++) {
  const gradient = elemsWithGradients[elem].getAttribute('data-gradient');
  GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
}
toggleVisibility(scrollText);

export default body;

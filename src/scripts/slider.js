require('./vendor/gradientmaps.min.js'); // Generator of gradientmap
import animateScroll from './vendor/animatescroll.min.js'; // Pure JS animate scroll
require('waypoints'); // Waypoints for lazy load animations
require('./mobile-menu.js');
require('./common.js');
import { toggleVisibility, getOffsetY } from "./common.js";
import body from "./common.js";
const frame = document.getElementsByClassName('frame')[0];
const slides = frame.getElementsByClassName('slide');

// Mobile
const bodyBorder = Number(window.getComputedStyle(body, ':after').getPropertyValue('height').replace(/px$/, ''));
const scrollText = document.getElementsByClassName('slide__scrolling-text')[0];
let windowHeight = window.innerHeight;
let documentHeight = window.innerHeight;
let offsetTop;
const slideIndex = 0;

const lazyImage = function(){
  const backgroundImage = this.element.getElementsByClassName('slide-background__image')[0];
  if(backgroundImage){
    const newAttributes = `${backgroundImage.getAttribute('style')} ${backgroundImage.getAttribute('data-style')}`;
    backgroundImage.setAttribute('style', newAttributes);
    backgroundImage.removeAttribute('data-style');
  }
};

function assignSnapVariables (){
  for(let i = 0; i < slides.length; i++){
    new Waypoint({
      element: slides[i],
      handler: lazyImage,
      offset: '200%'
    })
  }
}
assignSnapVariables();

const calculateNearestSlide = dir => {
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

window.onscroll = () => {
  toggleVisibility(scrollText);
};

window.onresize = () => {
  assignSnapVariables();
}

window.onkeydown = e => {
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

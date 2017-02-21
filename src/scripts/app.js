require('./common.js');

// dependencies and configuration rockNslide
require('./vendor/gradientmaps.min.js');
require('./rock-n-slide.js');
import animateScroll from './vendor/animatescroll.min.js';
import { rockNslide } from "./rock-n-slide.js";

let config = {
  lazyLoad: false
}

rockNslide.init(config);

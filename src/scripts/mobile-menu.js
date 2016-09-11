let isMenuOpen = false;
const mobileMenuTrigger = document.getElementsByClassName('menu-nav__trigger')[0];
const mobileMenu = document.getElementsByClassName('slide--menu')[0];
const menuItem = document.getElementsByClassName('menu__nav-anchor');
const scrollText = document.getElementsByClassName('slide__scrolling-text')[0];
import { toggleVisibility } from "./common.js";
import body from "./common.js";

const toggleMobileMenu = () => {
  isMenuOpen = !isMenuOpen;
  mobileMenuTrigger.classList.toggle('menu-nav__trigger--active');
  mobileMenu.classList.toggle('slide--menu-active');
  toggleVisibility(scrollText);
  body.classList.toggle('overflow--hide');
};

mobileMenuTrigger.addEventListener('click', e => {
  e.preventDefault();
  toggleMobileMenu();
});

for (let i = 0; i < menuItem.length; i++) {
  menuItem[i].addEventListener('click', toggleMobileMenu);
}

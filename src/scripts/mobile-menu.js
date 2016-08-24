var body = document.getElementsByTagName('body')[0],
isMenuOpen = false,
mobileMenuTrigger = document.getElementsByClassName('menu-nav__trigger')[0],
mobileMenu = document.getElementsByClassName('slide--menu')[0],
menuItem = document.getElementsByClassName('mobile__menu-anchor'),
scrollText = document.getElementsByClassName('slide__scrolling-text')[0];

var getOffsetY = function(){
  return window.scrollY || window.pageYOffset;
}

var toggleVisibility = function(elem) {
  if (typeof elem !== "undefined" && elem !== null) {
    elem.style.opacity = getOffsetY() > 0 ? 0 : 1;
  }
};

var toggleMobileMenu = function() {
  isMenuOpen = !isMenuOpen;
  mobileMenuTrigger.classList.toggle('menu-nav__trigger--active');
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

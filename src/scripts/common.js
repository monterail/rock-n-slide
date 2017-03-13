const body = document.getElementsByTagName('body')[0];

// Is it IE?
((() => {
  const ieRegex = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
  if(ieRegex.exec(navigator.userAgent) != null){
    body.classList.add('ie');
  }
}))();

export default body;

/* before paint: apply the saved theme so the page does not flash */
(function(){try{var t=localStorage.getItem('trr-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})();

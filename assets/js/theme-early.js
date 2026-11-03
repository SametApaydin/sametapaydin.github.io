/* before paint: apply the saved theme so the page does not flash */
(function(){try{var t=localStorage.getItem('trr-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();

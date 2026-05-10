// تسجيل Service Worker بشكل هادئ بدون التأثير على منطق النظام
(function(){
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .catch(function(err){ console.warn('Service Worker registration failed:', err); });
  });
})();

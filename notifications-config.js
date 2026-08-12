window.NATSHA_NOTICE_CONFIG = Object.freeze({
  apiUrl: 'https://script.google.com/macros/s/AKfycbwqY9A2JlUEXxUJrTcMegJ0Qwy1cOn9jGiKb8E9ObWdkYy6jOlfROR0Kmx9G68q8N1H/exec',
  spreadsheetId: '1eDulzaGE3GRrfky_yq6p8yzxS45SJWl-qz5IgmKZbSE',
  ownerEmail: 'gazynn@gmail.com',
  whatsappEnabled: true,
  pushEnabled: true
});

(function(){
  if(!/family-admin\.html(?:$|[?#])/.test(location.pathname+location.search+location.hash))return;

  var dashboard=document.createElement('script');
  dashboard.src='whatsapp-dashboard-enhanced.js?v=20260809-1';
  dashboard.defer=true;
  document.head.appendChild(dashboard);

  var media=document.createElement('script');
  media.src='family-admin-media-addon.js?v=20260812-1';
  media.defer=true;
  document.head.appendChild(media);
})();

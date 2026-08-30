(function(){
  // OneSignal App ID inserted by user
  const APP_ID = '371ce308-7550-41b1-b46c-c01b173d68f8';

  // Load the OneSignal SDK (the SDK itself will handle subscription UI and service worker)
  (function(d, s, id){
    var js, sjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id; js.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
    sjs.parentNode.insertBefore(js, sjs);
  }(document, 'script', 'onesignal-jssdk'));

  window.OneSignal = window.OneSignal || [];
  OneSignal.push(function() {
    OneSignal.init({
      appId: APP_ID,
      notifyButton: { enable: true },
      allowLocalhostAsSecureOrigin: true
    });
  });

  // Helper to trigger the subscription prompt (can be wired to a button)
  window.requestPushPermission = async function(){
    OneSignal.push(function(){
      OneSignal.showSlidedownPrompt();
    });
  };
})();

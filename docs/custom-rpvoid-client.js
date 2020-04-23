(async () => {
    // appSrc = "/js/app.js?id=<token>"
    const res = await fetch(appSrc);
    let appCode = await res.text();

    appCode = appCode.replace('window.location.hostname', '"rpvoid.com"');
    appCode = appCode.replace(/([a-zA-Z]).walkSpeed=12,(.*?);/, '$1.walkSpeed=12,$2;window.stats=d;');

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.text = appCode;
    document.body.appendChild(script);
    document.body.removeChild(script);
})();
javascript: (function () {
    var text = document.body.innerText;
    var url = window.location.href;
    var title = document.title;
    var baseUrl = "https://treewx.github.io/floatywords/";
    var finalUrl = baseUrl + "?title=" + encodeURIComponent(title) + "&text=" + encodeURIComponent(text.substring(0, 2000)) + "&url=" + encodeURIComponent(url);
    window.open(finalUrl, '_blank');
})();

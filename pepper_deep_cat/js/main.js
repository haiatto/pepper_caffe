//
// 深窓のペッパー
//

$(function(){
    function MyModel() {
        var self = this;
        self.catServerUrl = ko.observable("");
        self.imageUrl     = ko.observable("http://www.widewallpapers.ru/mod/cats/1280x800/wide-wallpaper-1280x800-007.jpg");
        self.result       = ko.observable("");
        self.resultData   = ko.observable({});
        if(window.location.href.indexOf("file://")==0){
            self.catServerUrl("ws://192.168.11.16:8080");
        }else{
            self.catServerUrl("ws://"+window.location.host);
        }
        self.drawImage = function()
        {
            var image = new Image();
            image.crossOrigin = "Anonymous";
            image.src = self.imageUrl();
            image.onload = function() {
                var canvas = $("#canvas")[0];
                $(canvas).attr({width:image.width,height:image.height});
                var ctx = canvas.getContext('2d');                
                ctx.drawImage(image, 0, 0);
            };
        };
        self.drawImage();
        self.imageUrl.subscribe(function(){
            self.drawImage();
        });
        self.classifier   = function()
        {
            var ws = new WebSocket(self.catServerUrl()+"/ws_raw");
            ws.binaryType = 'arraybuffer';
            ws.onopen = function() {
                //ws.send(self.imageUrl()); 

                var canvas = $("#canvas")[0];
                var ctx = canvas.getContext('2d');
                var data = ctx.getImageData(0, 0, canvas.width,canvas.height).data;
                var headArray = new Uint8Array(5);
                headArray[0] = canvas.width & 0xFF;
                headArray[1] = (canvas.width>>8) & 0xFF;
                headArray[2] = canvas.height & 0xFF;
                headArray[3] = (canvas.height>>8) & 0xFF;
                headArray[4] = 4;
                var byteArray = new Uint8Array(data);
                var sendData = new Uint8Array(headArray.byteLength + byteArray.byteLength);
                sendData.set(headArray, 0);
                sendData.set(byteArray, headArray.byteLength);
                ws.send(sendData.buffer);
            };
            ws.onmessage = function (evt) {
                var data = JSON.parse(evt.data);
                var catCount = 0;
                $.each(data,function(k,v){
                    if ( /cat/.exec(v.class))
                    {
                        catCount++;
                    }
                });
                var resTxt = "";
                if(catCount>3){
                    resTxt = "きっと猫";
                }else if(catCount>1){
                    resTxt = "たぶん猫";
                }else{
                    resTxt = "猫じゃない！";
                }
                self.result(resTxt);
                self.resultData(data);
            };
        };
    };
    ko.applyBindings(new MyModel());
});

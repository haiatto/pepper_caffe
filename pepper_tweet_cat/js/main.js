//
// 深層のPepper猫とつぶやく
//

var userAgent  = window.navigator.userAgent.toLowerCase();
var appVersion = window.navigator.appVersion.toLowerCase();
function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) 
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) 
        {
            return sParameterName[1];
        }
    }
}
function _base64ToArrayBuffer(base64) {
    var binary_string =  window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array( len );
    for (var i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    //return bytes.buffer;
    return bytes;
}
function _arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}
function PepperCamera(alVideoDevice,option) {
    var self = this;
    self.subscribe = function(){
        if(!option){
            option = {};
        }
        option.name  = option.name  || "pepper_tweet_cam";
        option.cam   = option.cam   || 0;  // nao_top
        option.reso  = option.reso  || 1;  // 320x240
        option.color = option.color || 11; // Rgb
        option.frame_rate = option.frame_rate || 5; // frame_rate
         
        return alVideoDevice.getSubscribers().then(function(list){
            //6個まで制限があるそうなのでゴミ掃除
            $.each(list,function(k,v){
                if(v.indexOf(option.name)==0)//とりあえず前方一致で同じと判断してみる
                {
                    alVideoDevice.unsubscribe(v);
                }
            })
        })
        .then(function(){
            return alVideoDevice.subscribeCamera(
                option.name, 
                option.cam,
                option.reso,
                option.color,
                option.frame_rate
            );
        })
        .then(function(nameId){
            self.nameId=nameId;
        });
    };
    self.unsubscribe = function()
    {
        alVideoDevice.unsubscribe(self.nameId);
        self.nameId = None;
    };
    self.captureImage = function(callback)
    {
        if(self.nameId && self.nameId.length>0)
        {
            alVideoDevice.getImageRemote(self.nameId).done(function(data){
              if(data)
              {
                  var buff = _base64ToArrayBuffer(data[6]);
                  callback(data[0],data[1], buff, data[7], data[8], data[9], data[10], data[11]);
              }
            });
        }
    };
    self.subscribe();
}

function ImageList()
{
    var self = this;

    self.list = ko.observableArray();

    ko.bindingHandlers.imageListDraw = {
        init: function(element, valueAccessor) {
            // 画像をcanvasに
            var tgtCanvas = element;
            var image     = ko.utils.unwrapObservable(valueAccessor());

            var c  = tgtCanvas.getContext('2d');
            var cw = tgtCanvas.width;
            var ch = tgtCanvas.height;
            c.clearRect(0, 0, cw, ch);
            var imageData = c.createImageData(image.w, image.h);
            var pixels = imageData.data;
            for (var i=0; i < pixels.length/4; i++) {
                pixels[i*4+0] = image.pixels[i*4+0];
                pixels[i*4+1] = image.pixels[i*4+1];
                pixels[i*4+2] = image.pixels[i*4+2];
                pixels[i*4+3] = 255;
            }
            c.putImageData(imageData, 0, 0);
        },
        update: function(element, valueAccessor) {
        }
    };
    self.pushImage = function(data)
    {
        if(data.image){
            self.list.push(data.image);
        }
    }
}

function Main(imageList) {
    var self = this;
    var qims = null;

    self.connect = function(ip,catServerUrl,obsvState,obsvResult){
        self.catServerUrl = catServerUrl;
        if(qims){
            if(obsvState()!="接続中にゃん(@.@)"){
                qims.socket().socket.connect();
            }
        }
        else{
            if(self.lunchPepper){
                qims = new QiSession();
            }else{
                qims = new QiSession(ip);
            }
            qims.socket()
            .on('connect', function (aa) {
                obsvState("接続中にゃん(@.@)");
                qims.service("ALTextToSpeech")
                .done(function (tts) {
                    tts.say("せつぞく、にゃん");    
                    self.tweetLoop(obsvResult)
                    .fail(function(err){
                        obsvResult("エラーにゃん " + err);
                    });
                });
            })
            .on('disconnect', function (aa) {
              obsvState("切断にゃん(@x@)");
            });
        }
    };
    self.disconnect = function(){    
    };
    self.tweetLoop = function(obsvResult){
        if(!qims){
            return;
        }
        var pcam;
        var canvasLayer0 = $(".camCanvasLayer")[0];
        var canvasLayer1 = $(".camCanvasLayer")[1];
        var canvasLayer2 = $(".camCanvasLayer")[2];
        var genralDataTable = {};

        var capImgDfdFunc = function(){//イメージをキャプチャして返えすdfd関数です
            var dfd = $.Deferred();
            pcam.captureImage(function(w,h,data,camId,l,t,r,b){
                // 受信したRAWデータをcanvasに                
                var pixels = new Uint8Array(w*h*4);
                for (var i=0; i < pixels.length/4; i++) {
                    pixels[i*4+0] = data[i*3+0];
                    pixels[i*4+1] = data[i*3+1];
                    pixels[i*4+2] = data[i*3+2];
                    pixels[i*4+3] = 255;
                }
                var image={};
                image.pixels = pixels;
                image.w = w;
                image.h = h;
                dfd.resolve(image);
            });
            return dfd.promise();
        };
        var makeDfdFuncDrawImg = function(tgtCanvas,x,y,alpha){//イメージをキャンバスに描くdfd関数を作ります
            return function(srcImage){
                // 画像をcanvasに
                if(!srcImage || !srcImage.pixels){
                    return;
                }
                var c = tgtCanvas.getContext('2d');
                var cw = tgtCanvas.width;
                var ch = tgtCanvas.height;
                c.clearRect(0, 0, cw, ch);
                var imageData = c.createImageData(srcImage.w, srcImage.h);
                var pixels = imageData.data;
                for (var i=0; i < pixels.length/4; i++) {
                    pixels[i*4+0] = srcImage.pixels[i*4+0];
                    pixels[i*4+1] = srcImage.pixels[i*4+1];
                    pixels[i*4+2] = srcImage.pixels[i*4+2];
                    pixels[i*4+3] = alpha;
                }
                c.putImageData(imageData, x, y);
            };
        };
        var makeDfdFuncSetCapImg = function(name){//イメージに名前を付けて記憶してイメージを返すdfd関数を作ります
            return function(img){
                return $.Deferred(function(dfd){
                    genralDataTable[name] = {image:img};
                    dfd.resolve(img);
                });
            };
        };
        var makeDfdFuncSetGeneral = function(name){//汎用データに名前を付けて記憶してそのまま汎用データを返すdfd関数を作ります
            return function(data){
                return $.Deferred(function(dfd){
                    genralDataTable[name] = data;
                    dfd.resolve(data);
                });
            };
        };
        var makeDfdFuncGetGeneral = function(name){//名前から汎用データを返すdfd関数を作ります
            return function(data){
                return $.Deferred(function(dfd){
                    dfd.resolve(genralDataTable[name]);
                });
            };
        };
        var makeDfdFuncWaitTime = function(ms){//指定ミリ秒待つdfd関数を作ります
            return function(){
                return $.Deferred(function(dfd){
                    setTimeout(dfd.resolve,ms);
                });  
            };
        };

        //2つイメージの差分があればその領域を切り抜いたイメージを返すdfd関数を作ります。
        //無い場合は空のイメージを返します
        var makeDfdFuncDiffClipImage = function(name0,name1){
          return function(){
            return $.Deferred(function(dfd){
              var img0 = genralDataTable[name0]&&genralDataTable[name0].image;
              var img1 = genralDataTable[name1]&&genralDataTable[name1].image;
              if(img0 && img1){
                  var minX=9999;
                  var minY=9999;
                  var maxX=0;
                  var maxY=0;
                  var data = {pixels:null,w:0,h:0};
                  if(img0.pixels && img1.pixels){
                      var checkSize   = 4;//8;
                      var w = Math.min(img0.w,img1.w);
                      var h = Math.min(img0.h,img1.h);
                      var bh = Math.floor(h/checkSize);
                      var bw = Math.floor(w/checkSize);
                      for(var by=0; by < bh; by++){
                          for(var bx=0; bx < bw; bx++){
                              var sum = 0;
                              for(var oy=0; oy < checkSize; oy++){
                                  for(var ox=0; ox < checkSize; ox++){
                                      var p0 = (img0.w * by*checkSize + bx*checkSize)*4;
                                      var p1 = (img1.w * by*checkSize + bx*checkSize)*4;
                                      sum += Math.abs(img0.pixels[p0+0] - img1.pixels[p1+0]);
                                      sum += Math.abs(img0.pixels[p0+1] - img1.pixels[p1+1]);
                                      sum += Math.abs(img0.pixels[p0+2] - img1.pixels[p1+2]);
                                  }
                              }
                              if(sum > checkSize*checkSize * 130){
                                  minX = Math.min(minX, bx*checkSize);
                                  minY = Math.min(minY, by*checkSize);
                                  maxX = Math.max(maxX, bx*checkSize+checkSize);
                                  maxY = Math.max(maxY, by*checkSize+checkSize);
                              }
                          }                      
                      }
                      if(minX < maxX){
                          minX = Math.max(minX-10, 0);
                          minY = Math.max(minY-10, 0);
                          maxX = Math.min(maxX+10, img1.w);
                          maxY = Math.min(maxY+10, img1.h);
                          var w = maxX - minX;
                          var h = maxY - minY;
                          var pixels = new Uint8Array(w*h*4);
                          for(var y=0; y < h; y++){
                              for(var x=0; x < w; x++){
                                  var pis = (img1.w*(y+minY)+x+minX)*4;
                                  var pid = (w*y+x)*4;
                                  pixels[pid+0] = img1.pixels[pis+0];
                                  pixels[pid+1] = img1.pixels[pis+1];
                                  pixels[pid+2] = img1.pixels[pis+2];
                                  pixels[pid+3] = img1.pixels[pis+3];
                              }
                          }
                          data.w = w;
                          data.h = h;
                          data.pixels = pixels;
                      }
                  }
                  dfd.resolve(data);
              }else{
                  dfd.reject();
              }
            }).promise();
          };
        };
        // 猫を判定して判定結果を返すdfd関数を作ります
        var makeDfdFuncCaffeDeepCat = function(catServerUrl, imageName0){
            return function(){
                var img0 = genralDataTable[imageName0]&&genralDataTable[imageName0].image;
                if(!img0 || !img0.pixels){
                    return;
                }
                obsvResult("判定中(@O@)");
                var dfd = $.Deferred();
                var ws = new WebSocket(catServerUrl+"/ws_raw");
                ws.binaryType = 'arraybuffer';
                ws.onopen = function() {
                    var headArray = new Uint8Array(5);
                    headArray[0] = img0.w & 0xFF;
                    headArray[1] = (img0.w>>8) & 0xFF;
                    headArray[2] = img0.h & 0xFF;
                    headArray[3] = (img0.h>>8) & 0xFF;
                    headArray[4] = 4;
                    var byteArray = new Uint8Array(img0.pixels);
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
                    var resFlag = false;
                    if(catCount>3){
                        resTxt = "きっと猫";
                        resFlag = true;
                    }else if(catCount>1){
                        resTxt = "たぶん猫";
                        resFlag = true;
                    }else{
                        resTxt = "猫じゃない！";
                        resFlag = false;
                    }
                    obsvResult(resTxt+"(@_@)");
                    ws.close();
                    ws = null;
                    dfd.resolve({text:resTxt, bool:resFlag, deepCatData:data});
                };
                ws.onerror = function(){
                    dfd.reject("サーバー接続できない？");
                };
                return dfd;
            };
        };
        // IF文のようなDfd関数を作ります
        var makeDfdFuncIf = function(cmpDfdFunc, trueDfdFunc, falseDfdFunc){
            return function(){
                return cmpDfdFunc().then(function(data){
                    if(data && data.bool){
                        if(trueDfdFunc)return trueDfdFunc();
                    }else{
                        if(falseDfdFunc)return falseDfdFunc();
                    }
                });
            };
        };
        var makeDfdFuncTweetText = function(name0){
            return function(){
                var data = genralDataTable[name0];
                if(data.text){
                    return qims.service("ALTextToSpeech")
                    .then(function (tts) {
                        tts.say(data.text);    
                    });
                }
            };
        };
        var makeDfdFuncPushImage = function(name0){
            return function(){
                var data = genralDataTable[name0];
                if(data.image && data.image.pixels){
                    imageList.pushImage(data);
                }
            };
        };
        var mainLoopDfdFunc = function(){
            var dfd=$.Deferred();
            dfd.resolve();
            return dfd
            .then(capImgDfdFunc)
            .then(makeDfdFuncSetCapImg("image0"))
            .then(makeDfdFuncDrawImg(canvasLayer0, 0,0, 255))
            .then(makeDfdFuncWaitTime(0.1*1000))
            .then(capImgDfdFunc)
            .then(makeDfdFuncSetCapImg("image1"))
            .then(makeDfdFuncDrawImg(canvasLayer1, 0,0, 128))
            .then(makeDfdFuncDiffClipImage("image0","image1"))
            .then(makeDfdFuncSetCapImg("movedImage"))
            .then(makeDfdFuncDrawImg(canvasLayer2, 0,0, 255))
            .then(makeDfdFuncCaffeDeepCat(self.catServerUrl,"movedImage"))
            .then(makeDfdFuncSetGeneral("deepCatRes"))
            //.then( makeDfdFuncPushImage("movedImage"))
            .then(makeDfdFuncIf(
                makeDfdFuncGetGeneral("deepCatRes"),
                function(){
                    return makeDfdFuncTweetText("deepCatRes")()
                    .then( makeDfdFuncPushImage("movedImage"))
                    ;
                }
            ))
            .then(mainLoopDfdFunc)
            ;
        };

        return qims.service('ALVideoDevice')
        .then(function(alVideoDevice){
            pcam = new PepperCamera(alVideoDevice,{name:"pepper_tweet_top_cam",cam:0});
            return pcam.subscribe();
        })
        .then(mainLoopDfdFunc);
    };
}

$(function(){
    function MyModel() {
        var self = this;

        var imageList = new ImageList();
        var main = new Main(imageList);

        // IP入力部分
        self.ipX000 = ko.observable(192);
        self.ip0X00 = ko.observable(168);
        self.ip00X0 = ko.observable(1);
        self.ip000X = ko.observable(2);

        var pepper_ip;
        if(localStorage){
            pepper_ip = JSON.parse(localStorage.getItem("pepper_ip"));
        }
        if(pepper_ip){
            self.ipX000( pepper_ip.ip[0] );
            self.ip0X00( pepper_ip.ip[1] );
            self.ip00X0( pepper_ip.ip[2] );
            self.ip000X( pepper_ip.ip[3] );
        }
        else{
            pepper_ip = {
                ip:[self.ipX000(),
                    self.ip0X00(),
                    self.ip00X0(),
                    self.ip000X(),],
            };
            if(localStorage){
                localStorage.setItem("pepper_ip",JSON.stringify(pepper_ip));
            }
        }

        //
        self.catImageList = imageList.list;

        //
        self.catServerUrlObsv = ko.observable("ws://192.168.11.16:8080");
        if(localStorage){
            cat_server_info = JSON.parse(localStorage.getItem("cat_server_info"));
            if(cat_server_info){
                self.catServerUrlObsv(cat_server_info.url);
            }
            self.catServerUrlObsv.subscribe(function(){
                localStorage.setItem("cat_server_info",JSON.stringify({url:self.catServerUrlObsv()}));
            });
        }

        self.nowState = ko.observable("未接続にゃん");
        self.result   = ko.observable("");
        self.connect = function() 
        {
            var pepper_ip = JSON.parse(localStorage.getItem("pepper_ip"));
            var ip = 
            pepper_ip.ip[0] + "." +
            pepper_ip.ip[1] + "." +
            pepper_ip.ip[2] + "." +
            pepper_ip.ip[3];
            var catServerUrl = self.catServerUrlObsv();
            main.connect(ip, catServerUrl, self.nowState, self.result);
        };
        self.disconnect = function()
        {
            main.disconnect();
        };

        //
        self.canvasLayers = ['layer0','layer1','layer2','layer3','layer4'];
    };
    ko.applyBindings(new MyModel());
});

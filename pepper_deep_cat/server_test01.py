#!/bin/env python
# -*- coding: utf-8 -*-

# common
import os
import sys
import struct

# caffe
import numpy as np
import caffe

MODEL_FILE  = '../caffe/models/bvlc_reference_caffenet/deploy.prototxt'
PRETRAINED  = '../caffe/models/bvlc_reference_caffenet/bvlc_reference_caffenet.caffemodel'
LABEL_WORDS = '../caffe/data/ilsvrc12/synset_words.txt'

caffe.set_mode_cpu()
net = caffe.Classifier(MODEL_FILE, PRETRAINED,
                       mean=np.load('../caffe/python/caffe/imagenet/ilsvrc_2012_mean.npy').mean(1).mean(1),
                       channel_swap=(2,1,0),
                       raw_scale=255,
                       image_dims=(256, 256))

# tornado
import time
import tornado.ioloop
import tornado.web
import tornado.websocket
from tornado.ioloop import PeriodicCallback

from tornado.options import define, options, parse_command_line

define("port", default = 8080, help = "run on the given port", type = int)

class IndexHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    def get(self):
        self.render("index.html")

#URLの画像を認識するバージョン(クロスオリジンとか面倒なので別バージョンを用意)
class ClassifierWsUrl(tornado.websocket.WebSocketHandler):
    #on_message -> receive data
    #write_message -> send data

    #これがないと403が帰った
    def check_origin(self, origin):
        return True

    def open(self):
        self.i = 0
        print "WebSocket opened" 

    def on_close(self):
        print "WebSocket closed"

    #クライアントからメッセージが送られてくると呼び出される
    def on_message(self, message):
        print message
        input_image = caffe.io.load_image(message)
        self.write_message(predictImage(input_image))

    def predictImage_(self, input_image):
        scoreList  = net.predict([input_image])
        labelList  = np.loadtxt(LABEL_WORDS, str, delimiter="\t")

        labeledList = zip(scoreList[0].tolist(), labelList)
        labeledList.sort(cmp=lambda x, y: cmp(x[0], y[0]), reverse=True)
        
        result = "["
        for rank, (score, name) in enumerate(labeledList[:10], start=1):
            print('#%d | %s | %4.1f%%' % (rank, name, score * 100))
            if rank != 1:
                result = result + ',' 
            result = result + '{"class":"%s","score":%4.1f}' % (name, score * 100)
        result = result + "]"
        return result

class ClassifierWsRaw(ClassifierWsUrl):
    def on_message(self, message):
        widht, height, slide = struct.unpack('<HHb', message)
        input_image = np.fromstring(message, dtype=np.uint8)[12:]
        input_image = input_image.reshape((height,widht,slide))
        input_image = input_image[:, :, :3]
        input_image = input_image.astype(np.float)
        input_image = input_image * (1.0/256.0)
        self.write_message(predictImage(input_image))

handlers = [
    (r'/css/(.*)',  tornado.web.StaticFileHandler, {'path': os.path.join(os.getcwd(),"css")}),
    (r'/js/(.*)',   tornado.web.StaticFileHandler, {'path': os.path.join(os.getcwd(),"js")}),
    (r'/libs/(.*)', tornado.web.StaticFileHandler, {'path': os.path.join(os.getcwd(),"libs")}),
    (r"/", IndexHandler),
    (r"/ws_url", ClassifierWsUrl),
    (r"/ws_raw", ClassifierWsRaw),
]

app = tornado.web.Application(handlers,
    template_path=os.getcwd(),
    static_path  =os.getcwd(),
)

if __name__ == "__main__":
    parse_command_line()
    app.listen(options.port)
    print "start!"
    tornado.ioloop.IOLoop.instance().start()

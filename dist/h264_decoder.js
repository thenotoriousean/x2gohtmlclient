function H264Decoder(module, postFunc) {
    this.module = module;
  
    var _this = this;

    var frameCallback = module.addFunction(function (addr_g, addr_b, addr_r, stride_g, stride_b, stride_r, width, height, pts) {
      let out_g = module.HEAPU8.subarray(addr_g, addr_g + stride_g * height)
      let out_b = module.HEAPU8.subarray(addr_b, addr_b + stride_b * height)
      let out_r = module.HEAPU8.subarray(addr_r, addr_r + stride_r * height)
      let buf_g = new Uint8Array(out_g)
      let buf_b = new Uint8Array(out_b)
      let buf_r = new Uint8Array(out_r)
      let data = new Uint8Array(buf_g.length*4)
      for(let i=0; i<width*height; i++){
          data[i*4]   = buf_r[i];
          data[i*4+1] = buf_g[i];
          data[i*4+2] = buf_b[i];
          data[i*4+3] = 255;
      }
      var objData = {
          type: 'pictureReady',
          data: data,
          width: width,
          height, height,
          croppingParams: null,
      };
      postFunc(objData, [objData.data.buffer]);
    },'viiiiiiiii');
  
    this._ctx = module._decoder_context_new(frameCallback);
  };
  
  H264Decoder.prototype.decode = function(data) {
    var module = this.module
  
    if (data instanceof ArrayBuffer) {
      data = new Uint8Array(data)
    }
  
    var pInput = module._malloc(data.byteLength);
    module.HEAPU8.set(data, pInput);
  
    module._decode(this._ctx, pInput, data.byteLength)
    module._free(pInput);
  }
  
  H264Decoder.prototype.close = function() {
    var module = this.module
    module._decoder_context_free(this._ctx)
  };
  
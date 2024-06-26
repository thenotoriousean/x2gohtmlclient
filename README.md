# 原版安装教程参考：https://wiki.x2go.org/doku.php/wiki:advanced:x2gohtmlclient?s[]=html
# 原版x2go的html客户端包含三部分内容：x2gohtmlclient、x2gowebrpc、x2gowswrapper，此版本的客户端在原版基础上添加了webassembly解码模块，主要改动主要集中于x2gohtmlclient部分，xorg版本为deb11u11，具体安装步骤如下：

# 安装相关环境
1. 安装相关依赖：
`apt install -y gcc g++ build-essential make automake autogen autoconf aptitude git qtbase5-dev libqt5x11extras5-dev qttools5-dev-tools openssl`

# 安装nginx环境
1. 下载nginx: `apt -y install nginx`
2. 修改nginx配置：
修改文件：`nano /etc/nginx/nginx.conf`，在 http 中添加配置，根据自身配置修改ssl_certificate、ssl_certificate_key、root的路径：

server {
  listen 443 ssl;
  server_name your_host;
  ssl_certificate "/etc/nginx/private/server.crt";
  ssl_certificate_key "/etc/nginx/private/server.key";
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
  ssl_protocols TLSv1.2;
  ssl_prefer_server_ciphers off;
  ssl_session_timeout 5m;
  ssl_session_cache builtin:1000  shared:SSL:10m;
  ssl_session_tickets off;
  root /var/www/html;
  proxy_read_timeout 300;

  location /assets/ {
    add_header Strict-Transport-Security "max-age=31536000";
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' data: blob: ws: wss:; script-src 'self' 'unsafe-inline'";
    add_header Feature-Policy "vibrate 'none' ; microphone 'none' ; camera 'none' ; gyroscope 'none' ; magnetometer 'none' ; geolocation 'none' ; midi 'self' ; notifications 'self' ; push 'self' ; sync-xhr 'self'";
    add_header Referrer-Policy "same-origin";
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "SAMEORIGIN";
  }

  location ~* \.(pl|cgi)$ {
    gzip off;
    include /etc/nginx/fastcgi_params;
    fastcgi_pass  unix:/var/run/fcgiwrap.socket;
  }

  location ~ ^/x2gows/(.*)$ {
    proxy_pass       https://127.0.0.1:$1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_intercept_errors on;
    proxy_redirect off;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-NginX-Proxy true;
    proxy_ssl_session_reuse off;
  }
}

# 生成证书：
1. 进入目录/etc/nginx/private进行操作:
- `mkdir /etc/nginx/private`
- `cd /etc/nginx/private`
2. 生成私钥：`openssl genrsa -des3 -out server.key 2048`，输入密码
3. 创建证书签名请求CSR文件：`openssl req -new -key server.key -out server.csr`，填写相关信息
4. 复制一份 key 用以消除 key 的密码: `cp server.key server.key.copy`
5. 消除 key 的密码: `openssl rsa -in server.key.copy -out server.key`
6. 生成CA证书: `openssl x509 -req -sha256 -days 3650 -in server.csr -signkey server.key -out server.crt`
7. 添加访问权限：
- `chmod a+r server.key`
- `chmod a+r server.crt`

# 下载源码(目录为/var/www/html)：
1. `git clone https://github.com/thenotoriousean/x2gohtmlclient.git /var/www/html/x2gohtmlclient`(此项目不能放在/root路径下，否则前端无法访问！，建议克隆到/var/www/html下)
3. `git clone git://code.x2go.org/x2gowswrapper.git`

# 编译x2gowswrapper
1. 进入x2gowswrapper目录: 
2. 编译：`qmake && make`
3. 将生成的x2gowswrapper复制到 /usr/sbin下：`cp x2gowswrapper /usr/sbin`
3. 创建日志目录：`mkdir /var/log/x2gows`
4. 创建x2gows配置文件目录：`mkdir -p /etc/x2go/x2gows`
5. 创建x2gows配置文件：`nano /etc/x2go/x2gows/x2gows.options`
6. x2gows.options中添加内容：
`
ws_proto=wss
ssl_cert=/etc/nginx/private/server.crt
ssl_key=/etc/nginx/private/server.key
ssl_only=true
log_dir=/var/log/x2gows
`

# 安装emsdk(按照官网安装教程进行安装，安装版本：3.1.18,官网：https://emscripten.org/docs/getting_started/downloads.html)
1. `cd /root/qs`
2. `git clone https://github.com/emscripten-core/emsdk.git`
3. `cd emsdk`
4. `./emsdk install 3.1.18`
5. `./emsdk activate 3.1.18`
6. `source ./emsdk_env.sh`


# 构建x2gohtmlclient
1. 安装相关依赖包：`apt install fcgiwrap perl minify websockify python cmake`
2. 使用CPANM shell安装perl相关模块：
- `perl -MCPAN -e shell`
- `install CGI JSON Encode Expect File::Touch`
3. 安装完成后退出：`quit`
2. 进入x2gohtmlclient目录下执行minify文件：`./minify.sh`

## 编译x264:
1. 进入x2gohtmlclient/src目录进行操作:`cd /var/www/html/x2gohtmlclient/src`
2. 下载x264：
`git clone \
      --branch stable \
      --depth 1 \
      https://github.com/ffmpegwasm/x264
`
3. 进入x264目录进行操作: `cd x264`
4. 使用emsdk进行编译安装：
`
emconfigure ./configure \
      --prefix=../build \
      --host=x86-gnu \
      --enable-static \
      --disable-cli \
      --disable-asm \
      --disable-thread \
      --extra-cflags="-O3 -msimd128"
`
5. 安装：
- `emmake make install-lib-static -j`
- `embuilder build sdl2`
- `apt-get update && apt-get install -y pkg-config`

## 编译ffmpeg:
1. 进入src目录进行操作:`cd /var/www/html/x2gohtmlclient/src`
2. 下载ffmpeg：
`
git clone \
      --branch n6.0 \
      --depth 1 \
      https://github.com/FFmpeg/FFmpeg
`
3. 进入ffmpeg目录进行操作: `cd FFmpeg`
4. 使用emsdk进行编译安装：
`
emconfigure ./configure --cc="emcc" --cxx="em++" --ar="emar" --prefix=$(pwd)/dist --enable-cross-compile \
   --target-os=none --arch=x86_32 --cpu=generic \
    --enable-gpl --enable-version3 --disable-avdevice --disable-avformat --disable-swresample --disable-postproc --disable-avfilter \
    --disable-programs --disable-logging --disable-everything \
    --disable-ffplay --disable-ffprobe --disable-asm --disable-doc --disable-devices --disable-network \
    --disable-hwaccels --disable-parsers --disable-bsfs --disable-debug --disable-protocols --disable-indevs --disable-outdevs \
    --enable-decoder=h264  --enable-parser=h264
`
5. 安装：`make && make install`

## 安装webassembly模块：
1. 进入src目录进行操作:`cd /var/www/html/x2gohtmlclient/src`
2. 使用emcc进行编译安装：
`
emcc decoder.c FFmpeg/dist/lib/libavutil.a FFmpeg/dist/lib/libavcodec.a \
  -I "FFmpeg/dist/include" \
  -Wno-deprecated-declarations \
  -O3 -msimd128 \
  -sMODULARIZE \
  -sALLOW_TABLE_GROWTH=1 \
  -sALLOW_MEMORY_GROWTH \
  -sEXPORTED_FUNCTIONS=$(node export.js) \
  -sEXPORTED_RUNTIME_METHODS="['addFunction']" \
  -sRESERVED_FUNCTION_POINTERS=18 \
  -o ../dist/decoder.js
`
# 前端项目构建完成，浏览器访问https://localhost/x2gohtmlclient

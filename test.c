#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/imgutils.h>
#include <libavutil/avutil.h>
#include <libswscale/swscale.h>

static AVFrame *frame;
static AVFrame *rgbFrame;
static const AVCodec *codec;
static AVCodecContext *c = NULL;
static AVCodecParserContext *parser;
static uint8_t *out_buffer = NULL;
static struct SwsContext *img_convert_ctx;
static FILE *of;
static int num = 1;

static AVPacket *pkt;

void init(){
    avcodec_register_all();
 
    codec = avcodec_find_decoder(AV_CODEC_ID_H264);
    if (!codec) {
        fprintf(stderr, "Codec not found\n");
        exit(1);
    }
    c = avcodec_alloc_context3(codec);
    if (!c) {
        fprintf(stderr, "Could not allocate video codec context\n");
        exit(1);
    }
 
    if (avcodec_open2(c, codec, NULL) < 0) {
        fprintf(stderr, "Could not open codec\n");
        exit(1);
    }

    parser = av_parser_init(codec->id);
    if (!parser) {
        fprintf(stderr, "parser not found\n");
        exit(1);
    }

}

void parse_frame(){

}

void decode(){
    
    int ret = avcodec_send_packet(c, pkt);
    if (ret != 0)
	{
		printf("avcodec_send_packet error\n");
	}

    AVFrame *frame = av_frame_alloc();
    // AVFrame *rgbFrame = av_frame_alloc();
    
	ret = avcodec_receive_frame(c, frame);
    
    while (1)
	{
		if (ret == 0)
		{
			int width = frame->width;
			int height = frame->height;

            // struct SwsContext* conversion = sws_getContext(width, height, c->pix_fmt,
            //                                   width, height, AV_PIX_FMT_RGBA,
            //                                   SWS_BICUBIC, NULL, NULL, NULL);

            // av_image_alloc(rgbFrame->data, rgbFrame->linesize, width, height, AV_PIX_FMT_RGBA, 1);

	      	// 	ret = sws_scale(conversion, frame->data, frame->linesize, 0, height, rgbFrame->data, rgbFrame->linesize);

            // fseek(of, 0, SEEK_END);
            // fwrite(rgbFrame->data[0], 1, rgbFrame->linesize[0] * height, of);

            // sws_freeContext(conversion);

            fwrite(frame->data[0], 1, frame->linesize[0] * frame->height, of);  // Y
            fwrite(frame->data[1], 1, frame->linesize[1] * frame->height / 2, of);  // U
            fwrite(frame->data[2], 1, frame->linesize[2] * frame->height / 2, of);  // V
			
			ret = avcodec_receive_frame(c, frame);
			if (ret != 0) {
				
				break;
			}
		}
		else {
			
			break;
		}
	}
    av_frame_free(&frame);
    av_frame_free(&rgbFrame);
    
}

void main(){
    int file_num = 1;
    long filelen;
    unsigned char *inputbuf = NULL;
    unsigned char *temp = NULL;
    int left_size = 0, data_size;

    pkt = av_packet_alloc();
    if (!pkt)
        exit(1);

    of = fopen("/root/Desktop/out.raw","wb");

    init();
    char filename[20];
    sprintf(filename, "samples/%d", file_num++);
    FILE *in = fopen(filename,"rb");

    while(in != NULL){
        fseek(in, 0, SEEK_END);
        filelen = ftell(in);
        fseek(in, 0, SEEK_SET);

        //读取数据到inputbuf
        if(inputbuf == NULL){
            data_size = filelen;
            inputbuf = (unsigned char *)malloc(filelen);
            fread(inputbuf, 1, filelen, in);
            printf("%d...",file_num-1);
        }
        else{
            temp = (unsigned char *)malloc(filelen + data_size);
            memmove(temp, inputbuf, data_size);
            fread(temp, 1, filelen, in);
            printf("%d...",file_num-1);

            //free(inputbuf);
            inputbuf = temp;
            temp = NULL;
            data_size = filelen + data_size;
        }

        //提取帧并解码
        while (data_size > 0) {
            
            int ret = av_parser_parse2(parser, c, &pkt->data, &pkt->size,
                                   inputbuf, data_size, AV_NOPTS_VALUE, AV_NOPTS_VALUE, 0);
            if (ret < 0) {
                printf("Error while parsing\n");
                exit(1);
            }
            printf("parse %d bytes\n" , ret);

            //这里向前移位
            inputbuf      += ret;
            data_size -= ret;


            if (pkt->size)
                decode();
        }

        fclose(in);
        sprintf(filename, "samples/%d", file_num++);
        in = fopen(filename,"rb");
    }
    fclose(of);
}
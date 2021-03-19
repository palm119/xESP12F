/*
XuRunHua
*/

//% color="#A117D5" weight=10 icon="\uf1eb" block="ESP12F无线模块"
namespace xESP12F {
    
    //类型定义
    type EvtAct = () => void;
    type EvtDict = (topic: string, data: string) => void;

    let data: string;                       //收到的数据包

    let wifiConn: EvtAct = null;            //Wifi连接
    let mqttConn: EvtAct = null;            //MQTT连接
    let mqttTopicData: EvtDict = null;      //收到MQTT话题数据

    //发送AT指令
    function sendAT(command: string, waitTime: number = 100) {
        // OD01.printString("Send:"+command.substr(0, 15))
        serial.writeString(command + "\u000D\u000A")
        basic.pause(waitTime)
    }

    //检索字符串后一段数据（空格或者回车换行分割）
    function seekNext(comma: boolean = true): string {
        for (let i = 0; i < data.length; i++) {
            if ((comma && data.charAt(i) == ',') || data.charAt(i) == '\r' || data.charAt(i) == '\n') {
                let ret = data.substr(0, i);
                data = data.substr(i + 1, data.length - i);
                return ret;
            }
        }
        return '';
    }

    //收到数据，处理数据回调函数
    //包括：网络连接/断开、MQTT服务器连接成功、收到MQTT话题数据
    serial.onDataReceived('\n', function () {
        data = serial.readString()
        if (data.length<=0) {
            return;
        }

        //Wifi状态
        if (data.length>=14 && data.substr(0, 4)=='WIFI') { 
            let str = seekNext();
            while (str.length>0) {
                if (str.length>=11 && str.substr(0, 11)=='WIFI GOT IP') {
                    if (wifiConn) {
                        wifiConn();
                    }
                    break;
                }
                str = seekNext();
            }
        }

        //MQTT服务器连接
        //+MQTTCONNECTED:0,1,"iot.kittenbot.cn","1883","",1
        if (data.indexOf("+MQTTCONNECTED")>=0 && mqttConn) {
            mqttConn();
        }

        //MQTT话题收据收到
        //+MQTTSUBRECV:<LinkID>,<"topic">,<data_length>,data
        let idx = data.indexOf("+MQTTSUBRECV");
        if (idx>=0) { 
            data = data.substr(idx+13, data.length-idx-13);
            let linkid: string = seekNext();
            let topic: string = seekNext();
            topic = topic.substr(1, topic.length-2);
            let len = parseInt(seekNext());
            let strData = data.substr(0, len);
            if (mqttTopicData) {
                mqttTopicData(topic, strData);
            }
        }
    })

    /**
     * Wifi模块设置端口
     * @param tx Tx pin; eg: SerialPin.P1
     * @param rx Rx pin; eg: SerialPin.P2
    */
    //% blockId=wifi_init block="Wifi 初始化|Tx pin %tx Rx pin %rx"
    //% weight=100
    export function wifi_init(tx: SerialPin, rx: SerialPin): void {
        serial.redirect(
            rx,
            tx,
            BaudRate.BaudRate115200
        );
        basic.pause(500);
        serial.setRxBufferSize(194);
        serial.setTxBufferSize(64);
        sendAT("AT+CWMODE=3");
    }

    /**
     * 设置 Wifi 路由器名称和密码
     * @param ap Wifi name; eg: ap
     * @param pass Wifi password; eg: 123456
     */
    //% blockId=wifi_join block="Wifi 连接路由器%ap 密码%pass"
    //% weight=98
    export function wifi_join(ap: string, pass: string): void {
        sendAT('AT+CWJAP=\"'+ap+'\",\"'+pass+'\"', 500)
    }

    /**
     * 当 Wifi 连接成功时
     * @param handler Wifi connected callback
    */
    //% blockId=on_wifi_connected block="Wifi 连接成功"
    //% weight=96
    export function on_wifi_connected(handler: () => void): void {
        wifiConn = handler;
    }

    /**
     * 设置MQTT服务器地址和客户端ID并连接
     * @param host Mqtt server ip or address; eg: iot.kittenbot.cn
     * @param clientid Mqtt client id; eg: microbit
    */
    //% blockId=mqtt_connect block="连接 MQTT 服务器%host 客户端ID%clientid"
    //% weight=94
    export function mqtt_connect(host: string, clientid: string): void {
        mqtt_connect_auth_port(host, 1883, clientid, '', '');
    }
    
    /**
     * 当 MQTT 服务器连接成功时
     * @param handler MQTT connected callback
    */
    //% blockId=on_mqtt_connected block="MQTT 服务器连接成功"
    //% weight=92
    export function on_mqtt_connected(handler: () => void): void {
        mqttConn = handler;
    }

    /**
     * MQTT 订阅 话题
     * @param topic Mqtt topic; eg: /hello
    */
    //% blockId=mqtt_subscribe block="MQTT 订阅话题 %topic"
    //% weight=90
    export function mqtt_subscribe(topic: string): void {
        sendAT('AT+MQTTSUB=0,\"'+topic+'\",0');
    }

    /**
     * MQTT 收到 话题当前的数据
    */
    //% blockId=on_mqtt_topic_data block="MQTT 收到话题数据"
    //% weight=88 draggableParameters=reporter
    export function on_mqtt_topic_data(handler: (topic: string, data: string) => void): void {
        mqttTopicData = handler;
    }

    /**
     * MQTT 广播 话题内容
     * @param topic Mqtt topic; eg: /hello
     * @param data Mqtt topic data; id; eg: 1
     */
    //% blockId=mqtt_publish block="MQTT 广播 话题%topic 内容%data"
    //% weight=86
    export function mqtt_publish(topic: string, data: string): void {
        sendAT('AT+MQTTPUB=0,\"'+topic+'\",\"'+data+'\",1,1');
    }

    /**
     * 设置 MQTT 服务器地址端口和认证信息
     * @param host Mqtt server ip or address; eg: iot.kittenbot.cn
     * @param clientid Mqtt client id; eg: microbit
     * @param port host port; eg: 1883
    */
    //% advanced=true
    //% blockId=mqtt_connect_auth_port block="连接 MQTT 服务器 %host|端口 %port|客户端ID %clientid|用户名 %username|密码 %pass"
    //% weight=84
    export function mqtt_connect_auth_port(host: string, port: number, clientid: string, username: string, pass: string): void {
        sendAT('AT+MQTTUSERCFG=0,1,\"'+clientid+'\",\"'+username+'\",\"'+pass+'\",0,0,\"\"');
        sendAT('AT+MQTTCONN=0,\"'+host+'\",'+port+',1');
    }

}
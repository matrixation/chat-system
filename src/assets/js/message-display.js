import emoji from '../json/emoji';
import toolbar from '../json/toolbar';
import lodash from 'lodash';
import base from "../../api/base";

export default {
    name: "message-display",
    data() {
        return {
            images:[],
            userId: this.$route.params.userId,
            messagesContainerTimer: "",
            onlineUsers: this.$store.state.onlineUsers,
            createDisSrc: require("../img/titlebar_function_createDis_normal@2x.png"),
            resourceObj: {
                createDisNormal: require("../img/titlebar_function_createDis_normal@2x.png"),
                createDisHover: require("../img/titlebar_function_createDis_hover@2x.png"),
                createDisClick: require("../img/titlebar_function_createDis_normal_p@2x.png"),
                phoneNormal: require("../img/phone_normal_ap@2x.png"),
                groupMsgImg: require("../img/group-msg-img.png"),
                avatarImg: require("../img/avatar.jpg"),
                msgImgTest: require("../img/msg-img-test.gif"),
                msgImgTestB: require("../img/msg-img-testB.gif"),
            },
            // 消息内容
            messageContent: "",
            InputContent: "",
            emoticonShowStatus: "none",
            emojiList: emoji,
            toolbarList: toolbar,
            senderMessageList: [],
            userID: this.$store.state.userID,
            audioCtx: null,
            // 声音频率
            arrFrequency: [
                196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50
            ],
        }
    },
    mounted: function () {
        // webAudioAPI兼容性处理
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        // 设置列容器高度
        this.$refs.messagesContainer.style.height = this.getThisWindowHeight() - 450 + "px";
        // 判断移动端打开
        if (this.getThisWindowWidth() < 500) {
            this.createDisSrc = this.$store.state.profilePicture;
            this.$refs.createDisSrcPanel.style.width = "40px";
            this.$refs.createDisSrcPanel.style.height = "40px";
            this.$refs.createDisSrcPanel.style.borderRadius = "50%";
            this.$refs.createDisSrcPanel.style.overflow = "hidden";
            this.resourceObj.createDisClick = this.$store.state.profilePicture;
            this.$refs.topPanel.style.height = "45px";
            this.$refs.messagesContainer.style.height = this.getThisWindowHeight() - 240 + "px";
            this.$refs.emoticonPanel.style.left = "0";
            this.$refs.emoticonPanel.style.width = this.getThisWindowWidth() + "px";
            this.$refs.sendPanel.style.display = "block";
        }
        /**
         * 监听剪切板粘贴事件: 实现图片粘贴
         */
        const that = this;
        document.body.addEventListener('paste', function (event) {
            that.$fullScreenLoading.show("读取图片中");
            // 获取当前输入框内的文字
            const oldText = that.$refs.msgInputContainer.textContent;
            // 读取图片
            let items = event.clipboardData && event.clipboardData.items;
            let file = null;
            if (items && items.length) {
                // 检索剪切板items
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        file = items[i].getAsFile();
                        break;
                    }
                }
            }
            // 预览图片
            const reader = new FileReader();
            reader.onload = function(event) {
                // 图片内容
                const imgContent = event.target.result;
                // 创建img标签
                let img = document.createElement('img');//创建一个img
                // 获取当前base64图片信息，计算当前图片宽高以及压缩比例
                let imgObj = new Image();
                let imgWidth = "";
                let imgHeight = "";
                let scale = 1;
                imgObj.src = imgContent;
                imgObj.onload = function() {
                    // 计算img宽高
                    if(this.width<400){
                        imgWidth = this.width;
                        imgHeight = this.height;
                    }else{
                        // 输入框图片显示缩小10倍
                        imgWidth = this.width/10;
                        imgHeight = this.height/10;
                        // 图片宽度大于1920，图片压缩5倍
                        if(this.width>1920){
                            // 真实比例缩小5倍
                            scale = 5;
                        }
                    }
                    // 设置可编辑div中图片宽高
                    img.width = imgWidth;
                    img.height = imgHeight;
                    // 压缩图片，渲染页面
                    that.compressPic(imgContent,scale,function (newBlob,newBase) {
                        // 删除可编辑div中的图片名称
                        that.$refs.msgInputContainer.textContent = oldText;
                        img.src = newBase; //设置链接
                        // 图片渲染
                        that.$refs.msgInputContainer.append(img);
                        that.$fullScreenLoading.hide();
                    });
                };
            };
            reader.readAsDataURL(file);
        });
        // 全局点击事件，点击表情框以外的地方，隐藏当前表情框
        document.addEventListener('click', (e) => {
            let thisClassName = e.target.className;
            if (thisClassName !== "emoticon-panel" && thisClassName !== "emoticon") {
                this.emoticonShowStatus = "none";
            }
        });
        //从本地存储中获取数据渲染页面
        this.renderPage("", "", 1);
        // 监听消息接收
        this.$options.sockets.onmessage = (res) => {
            const data = JSON.parse(res.data);
            if (data.code === 200) {
                this.$store.state.onlineUsers = data.onlineUsers;
                // 更新在线人数
                this.onlineUsers = data.onlineUsers;
            } else {
                this.$store.state.onlineUsers = data.onlineUsers;
                // 更新在线人数
                this.onlineUsers = data.onlineUsers;
                // 获取服务端推送的消息
                const msgObj = {
                    msg: data.msg,
                    avatarSrc: data.avatarSrc,
                    userID: data.userID,
                    username: data.username
                };
                // 播放消息提示音:判断当前消息是否为对方发送
                if (msgObj.userID !== this.$store.state.userID) {
                    this.audioCtx = new AudioContext();
                    // 非当前用户发送的消息
                    // 当前频率: 随机产生
                    let frequency = this.arrFrequency[(Math.floor(Math.random() * this.arrFrequency.length))];
                    // 创建音调控制对象
                    let oscillator = this.audioCtx.createOscillator();
                    // 创建音量控制对象
                    let gainNode = this.audioCtx.createGain();
                    // 音调音量关联
                    oscillator.connect(gainNode);
                    // 音量和设备关联
                    gainNode.connect(this.audioCtx.destination);
                    // 音调类型指定为正弦波
                    oscillator.type = 'sine';
                    // 设置音调频率: 最终播放的声音
                    oscillator.frequency.value = frequency;
                    // 先把当前音量设为0
                    gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
                    // 0.01秒时间内音量从刚刚的0变成1，线性变化
                    gainNode.gain.linearRampToValueAtTime(1, this.audioCtx.currentTime + 0.01);
                    // 声音走起
                    oscillator.start(this.audioCtx.currentTime);
                    // 2秒时间内音量从刚刚的1变成0.001，指数变化
                    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 2);
                    // 2秒后停止声音
                    oscillator.stop(this.audioCtx.currentTime + 2);
                }
                // 渲染页面:如果msgArray存在则转json
                if (lodash.isEmpty(localStorage.getItem("msgArray"))) {
                    this.renderPage([], msgObj, 0);
                } else {
                    this.renderPage(JSON.parse(localStorage.getItem("msgArray")), msgObj, 0);
                }
            }
        };
    },
    methods: {
        createDisEventFun: function (status) {
            if (status === "hover") {
                this.createDisSrc = this.resourceObj.createDisHover
            } else if (status === "leave") {
                this.createDisSrc = this.resourceObj.createDisNormal
            } else {
                this.createDisSrc = this.resourceObj.createDisClick
            }
        },
        getThisWindowHeight: () => window.innerHeight,
        getThisWindowWidth: () => window.innerWidth,
        sendMessage: function (event) {
            if (event.keyCode === 13) {
                // 阻止编辑框默认生成div事件
                event.preventDefault();
                let msgText = "";
                // 获取输入框下的所有子元素
                let allNodes = event.target.childNodes;
                for (let item of allNodes) {
                    // 判断当前元素是否为img元素
                    if (item.nodeName === "IMG") {
                        if (item.alt === "") {
                            // 是图片
                            let base64Img = item.src;
                            // 删除base64图片的前缀
                            base64Img = base64Img.replace(/^data:image\/\w+;base64,/, "");
                            //随机文件名
                            let fileName = (new Date()).getTime()+"chatImg" + ".jpeg";
                            //将base64转换成file
                            let imgFile = this.convertBase64UrlToImgFile(base64Img, fileName, 'image/jpeg');
                            let formData = new FormData();
                            // 此处的file与后台取值时的属性一样,append时需要添加文件名，否则一直是blob
                            formData.append('file', imgFile, fileName);
                            // 将图片上传至服务器
                            this.$api.fileManageAPI.baseFileUpload(formData).then((res) => {
                                let msgImgName = "";
                                const imgSrc = `${base.lkBaseURL}/uploads/chatImg/${res.fileName}`;
                                // 获取图片大小
                                let img = new Image();
                                let that = this;
                                let imgWidth = 0;
                                let imgHeight = 0;
                                // 判断参数是否为url
                                img.src = imgSrc;
                                // 判断图片是否有缓存
                                if(img.complete){
                                    imgWidth = img.width;
                                    imgHeight = img.height;
                                    msgImgName = `/${res.fileName}?width:${imgWidth}&height:${imgHeight}/`;
                                    // 消息发送: 发送图片
                                    that.$socket.sendObj({
                                        msg: msgImgName,
                                        code: 0,
                                        username: that.$store.state.username,
                                        avatarSrc: that.$store.state.profilePicture,
                                        userID: that.$store.state.userID
                                    });
                                }else{
                                    img.onload = function () {
                                        imgWidth = img.width;
                                        imgHeight = img.height;
                                        msgImgName = `/${res.fileName}?width=${imgWidth}&height=${imgHeight}/`;
                                        // 消息发送: 发送图片
                                        that.$socket.sendObj({
                                            msg: msgImgName,
                                            code: 0,
                                            username: that.$store.state.username,
                                            avatarSrc: that.$store.state.profilePicture,
                                            userID: that.$store.state.userID
                                        });
                                    }
                                }
                                // 清空输入框中的内容
                                event.target.innerHTML = "";
                            });
                        } else {
                            msgText += `/${item.alt}/`;
                        }
                    } else {
                        // 获取text节点的值
                        if (item.nodeValue !== null) {
                            msgText += item.nodeValue;
                        }
                    }
                }
                // 消息发送: 发送文字，为空则不发送
                if (msgText.trim().length > 0) {
                    this.$socket.sendObj({
                        msg: msgText,
                        code: 0,
                        username: this.$store.state.username,
                        avatarSrc: this.$store.state.profilePicture,
                        userID: this.$store.state.userID
                    });
                    // 清空输入框中的内容
                    event.target.innerHTML = "";
                }
            }
        },
        mobileSend: function () {
            // 模拟触发回车事件
            this.fireKeyEvent(this.$refs.msgInputContainer, 'keydown', 13);
        },
        // base图片压缩
        compressPic:function(base64, scale, callback){
            const that = this;
            let _img = new Image();
            _img.src = base64;
            _img.onload = function() {
                let _canvas = document.createElement("canvas");
                let w = this.width / scale;
                let h = this.height / scale;
                _canvas.setAttribute("width", w);
                _canvas.setAttribute("height", h);
                _canvas.getContext("2d").drawImage(this, 0, 0, w, h);
                let base64 = _canvas.toDataURL("image/jpeg");
                // 当canvas对象的原型中没有toBlob方法的时候，手动添加该方法
                if (!HTMLCanvasElement.prototype.toBlob) {
                    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
                        value: function (callback, type, quality) {
                            let binStr = atob(this.toDataURL(type, quality).split(',')[1]),
                                len = binStr.length,
                                arr = new Uint8Array(len);
                            for (let i = 0; i < len; i++) {
                                arr[i] = binStr.charCodeAt(i);
                            }
                            callback(new Blob([arr], {type: type || 'image/png'}));
                        }
                    });
                }else{
                    _canvas.toBlob(function(blob) {
                        if(blob.size > 1024*1024){
                            that.compressPic(base64, scale, callback);
                        }else{
                            callback(blob, base64);
                        }
                    }, "image/jpeg");
                }
            }
        },
        //  渲染页面
        renderPage: function (msgArray, msgObj, status) {
            if (status === 1) {
                // 页面第一次加载，如果本地存储中有数据则渲染至页面
                let msgArray = [];
                if (localStorage.getItem("msgArray") !== null) {
                    msgArray = JSON.parse(localStorage.getItem("msgArray"));
                    for (let i = 0; i < msgArray.length; i++) {
                        const thisSenderMessageObj = {
                            "msgText": msgArray[i].msg,
                            "msgId": i,
                            "avatarSrc": msgArray[i].avatarSrc,
                            "userID": msgArray[i].userID,
                            "username": msgArray[i].username
                        };
                        // 更新消息内容
                        this.messageContent = thisSenderMessageObj.msgText;
                        // 向父组件传值
                        this.$emit('updateLastMessage',this.messageContent);
                        // 解析并渲染
                        this.messageParsing(thisSenderMessageObj);
                    }
                }
            } else {
                // 判断本地存储中是否有数据
                if (localStorage.getItem("msgArray") === null) {
                    // 新增记录
                    msgArray.push(msgObj);
                    // 更新消息内容
                    this.messageContent = msgObj.msg;
                    // 向父组件传值
                    this.$emit('updateLastMessage',this.messageContent);
                    localStorage.setItem("msgArray", JSON.stringify(msgArray));
                    for (let i = 0; i < msgArray.length; i++) {
                        const thisSenderMessageObj = {
                            "msgText": msgArray[i].msg,
                            "msgId": i,
                            "avatarSrc": msgArray[i].avatarSrc,
                            "userID": msgArray[i].userID,
                            "username": msgArray[i].username
                        };
                        // 解析并渲染
                        this.messageParsing(thisSenderMessageObj);
                    }
                } else {
                    // 更新记录
                    msgArray = JSON.parse(localStorage.getItem("msgArray"));
                    msgArray.push(msgObj);
                    localStorage.setItem("msgArray", JSON.stringify(msgArray));
                    // 更新消息内容
                    this.messageContent = msgObj.msg;
                    // 向父组件传值
                    this.$emit('updateLastMessage',this.messageContent);
                    const thisSenderMessageObj = {
                        "msgText": msgObj.msg,
                        "msgId": Date.now(),
                        "avatarSrc": msgObj.avatarSrc,
                        "userID": msgObj.userID,
                        "username": msgObj.username
                    };
                    // 解析并渲染
                    this.messageParsing(thisSenderMessageObj);
                }
            }
        },
        // 模拟触发事件
        fireKeyEvent: function (el, evtType, keyCode) {
            let doc = el.ownerDocument,
                win = doc.defaultView || doc.parentWindow,
                evtObj;
            if (doc.createEvent) {
                if (win.KeyEvent) {
                    evtObj = doc.createEvent('KeyEvents');
                    evtObj.initKeyEvent(evtType, true, true, win, false, false, false, false, keyCode, 0);
                } else {
                    evtObj = doc.createEvent('UIEvents');
                    Object.defineProperty(evtObj, 'keyCode', {
                        get: function () {
                            return this.keyCodeVal;
                        }
                    });
                    Object.defineProperty(evtObj, 'which', {
                        get: function () {
                            return this.keyCodeVal;
                        }
                    });
                    evtObj.initUIEvent(evtType, true, true, win, 1);
                    evtObj.keyCodeVal = keyCode;
                    if (evtObj.keyCode !== keyCode) {
                        console.log("keyCode " + evtObj.keyCode + " 和 (" + evtObj.which + ") 不匹配");
                    }
                }
                el.dispatchEvent(evtObj);
            } else if (doc.createEventObject) {
                evtObj = doc.createEventObject();
                evtObj.keyCode = keyCode;
                el.fireEvent('on' + evtType, evtObj);
            }
        },
        // 消息解析
        messageParsing: function (msgObj) {
            // 解析接口返回的数据进行渲染
            let separateReg = /(\/[^/]+\/)/g;
            let msgText = msgObj.msgText;
            let finalMsgText = "";
            // 将符合条件的字符串放到数组里
            const resultArray = msgText.match(separateReg);
            if (resultArray !== null) {
                for (let item of resultArray) {
                    // 删除字符串中的/符号
                    item = item.replace(/\//g, "");
                    // 判断是否为图片: 后缀为.jpeg
                    if(this.isImg(item)){
                        const imgSrc = `${base.lkBaseURL}/uploads/chatImg/${item}`;
                        // 获取图片宽高
                        let imgInfo = {
                            "imgWidth":this.getQueryVariable(imgSrc,"width"),
                            "imgHeight":this.getQueryVariable(imgSrc,"height")
                        };
                        let thisImgWidth = 0;
                        let thisImgHeight = 0;
                        if(imgInfo.imgWidth<400){
                            thisImgWidth = imgInfo.imgWidth;
                            thisImgHeight = imgInfo.imgHeight;
                        }else{
                            // 缩放四倍
                            thisImgWidth = imgInfo.imgWidth / 4 ;
                            thisImgHeight = imgInfo.imgHeight / 4;
                        }
                        // 找到item中?位置，在?之前添加\\进行转义，解决正则无法匹配特殊字符问题
                        const charIndex = item.indexOf("?");
                        // 生成正则表达式条件，添加\\用于对？的转义
                        const regularItem = this.insertStr(item,charIndex,"\\");
                        // 解析为img标签
                        const imgTag = `<img width="${thisImgWidth}" height="${thisImgHeight}" src="${imgSrc}" alt="聊天图片">`;
                        // 替换匹配的字符串为img标签:全局替换
                        msgText = msgText.replace(new RegExp(`/${regularItem}/`, 'g'), imgTag);
                    }
                    // 表情渲染: 遍历表情配置文件
                    for (let emojiItem of this.emojiList) {
                        // 判断捕获到的字符串与配置文件中的字符串是否相同
                        if (emojiItem.info === item) {
                            const imgSrc = require(`../img/emoji/${emojiItem.hover}`);
                            const imgTag = `<img src="${imgSrc}" width="28" height="28" alt="${item}">`;
                            // 替换匹配的字符串为img标签:全局替换
                            msgText = msgText.replace(new RegExp(`/${item}/`, 'g'), imgTag);
                        }
                    }
                }
                finalMsgText = msgText;
            } else {
                finalMsgText = msgText;
            }
            msgObj.msgText = finalMsgText;
            // 渲染页面
            this.senderMessageList.push(msgObj);
            // 修改滚动条位置
            this.$nextTick(function () {
                this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
            });
        },
        // 显示表情
        toolbarSwitch: function (status, event, path, hoverPath, downPath, toolItemName) {
            if (status === "hover" || status === "up") {
                event.target.src = require(`../img/${hoverPath}`);
            } else if (status === "leave") {
                event.target.src = require(`../img/${path}`);
            } else {
                // 可编辑div获取焦点
                this.getEditableDivFocus();
                event.target.src = require(`../img/${downPath}`);
                // 表情框显示条件
                if (toolItemName === "emoticon") {
                    if (this.emoticonShowStatus === "flex") {
                        this.emoticonShowStatus = "none";
                    } else {
                        this.emoticonShowStatus = "flex";
                    }
                } else {
                    this.emoticonShowStatus = "none";
                }
            }
        },
        // 判断一个对象是否为函数类型
        isFunction: function (obj) {
            return typeof obj === "function" && typeof obj.nodeType !== "number";
        },
        // 表情框鼠标悬浮显示动态表情
        emojiConversion: function (event, status, path, hoverPath, info) {
            if (status === "over") {
                event.target.src = require(`../img/emoji/${hoverPath}`);
            } else if (status === "click") {
                // 表情输入
                const imgSrc = require(`../img/emoji/${hoverPath}`);
                const imgTag = `<img src="${imgSrc}" width="28" height="28" alt="${info}">`;
                document.execCommand("insertHTML", false, imgTag);
            } else {
                event.target.src = require(`../img/emoji/${path}`);
            }
        },
        // base64转file
        convertBase64UrlToImgFile: function (urlData, fileName, fileType) {
            // 转换为byte
            let bytes = window.atob(urlData);
            // 处理异常,将ascii码小于0的转换为大于0
            let ab = new ArrayBuffer(bytes.length);
            let ia = new Int8Array(ab);
            for (let i = 0; i < bytes.length; i++) {
                ia[i] = bytes.charCodeAt(i);
            }
            // 转换成文件，添加文件的type，name，lastModifiedDate属性
            let blob = new Blob([ab], {type: fileType});
            blob.lastModifiedDate = new Date();
            blob.name = fileName;
            return blob;
        },
        // 判断是否为图片
        isImg: function (str) {
            return str.indexOf(".jpeg") !== -1;
        },
        viewLargerImage: function(event){
            const imgSrc = event.target.src;
            if(typeof imgSrc !=="undefined"){
                // 清空图片数组
                this.images = [];
                this.images.push(imgSrc);
                this.show();
            }
        },
        // 获取url参数
        getQueryVariable:function(url,variable){
            // 对url进行截取
            url = url.substring(url.indexOf("?"),url.length);
            var query = url.substring(1);
            var vars = query.split("&");
            for (var i=0;i<vars.length;i++) {
                var pair = vars[i].split("=");
                if(pair[0] == variable){return pair[1];}
            }
            return false;
        },
        // 字符串指定位置添加字符
        insertStr: function(source,start, newStr){
            return source.slice(0, start) + newStr + source.slice(start);
        },
        // 可编辑div获取焦点
        getEditableDivFocus: function () {
            // 开头获取焦点
            this.$refs.msgInputContainer.focus();
        },
        // 图片查看插件
        show () {
            const viewer = this.$el.querySelector('.images').$viewer
            viewer.show()
        }
    },
    beforeRouteUpdate(to, form, next) {
        // 路由更新改变当前userId
        this.userId = to.params.userId;
        next();
    }
}
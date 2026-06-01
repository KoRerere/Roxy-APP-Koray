# 1. RoxyFirefox启动
```RoxyFirefox -profile data-dir  --remote-debugging-port=0  url1 url2 ...```
## 参数说明:
- ```-profile data-dir``` 指定数据目录，每个窗口一个，与chrome的user-data-dir意义一样，启动之前先创建data-dir目录，将加密后的指纹内容写入 ```data-dir/lumi.conf```中
- 指纹加密方法(与chrome相同)：```aes-256-gcm```，key:```402ead7d23b43b6d1e0528d4f99c59bd```, iv: ```3a105229aa31```
- ```--remote-debugging-port=0``` 自动生成调试端口，stderr会输出：WebDriver BiDi listening on ws://127.0.0.1:59935，后续用这个ws接口来做自动化
- ```url1 url2``` 启动时要打开的网址

# 2. 密码同步
在窗口关闭后，会在data-dir目录下生成lumilogin文件，同步改文件内容到后台，下次启动窗口之前将lumilogin还原

# 3. tab页同步
在窗口关闭后，会在data-dir目录下生成roxy_tabs文件，格式为json 数组，将url同步到后台，下次打开的时候添加到命令行参数（ url1 url2 ...）

# 4. 同步器使用
- 同步器只支持windows，同步器不能firefox和chrome混合使用
- firefox的bidi增加了```browser.getTabs```，```browser.setColor```，用户实现统一标签页，设置主窗口颜色
```browser.setColor```定义：
```
{
	id: seq,
	method: "browser.setColor",
	params: {
		color: "#FF0000"
	}
};
```
返回：
```
{
  "type": "success",
  "id": seq,
  "result": {}
}
```
```browser.getTabs```定义
```
{
	id: 1,
	method: "browser.getTabs",
	params: {}
};
```
返回:
```{
  "type": "success",
  "id": 1,
  "result": [
    "https://browserleaks.com/",
    "https://browserleaks.com/",
    "https://ip123.in/"
  ]
}
```

# 5. 其他数据同步
- ### 书签、历史记录，同步：
```places.sqlite```   -这个一定有
```places.sqlite-wal``` -可能有
```places.sqlite-shm``` -可能有
- ### LocalStorage 同步
```storage/default/*/ls/data.sqlite```
- ### IndexedDB 同步
```storage/default/*/idb/*.sqlite```
- ### Cookie同步 （与chrome同步类似）
用```bidi```协议

# 6. 指纹参数
```json
{
	"userAgent": "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",   
	"navigator": {
		"platform": "Linux x86_64",     // Linux: Linux x86_64 , Windows: Win32, mac: MacIntel, android: Linux armv81, ios: iPhone
		"hardwareConcurrency": 4,       // cpu核数，与chrome相同
		"maxTouchPoints": 5,			// 模拟android和ios的时候填：5 ， 其他填 0 
		"deviceMemory": 16,				// 内存与chrome相同
		"mobile":false					// 是否为移动端
	},
	"windowNum": 22,					// 窗口编号
	"timeZone": "America/Chicago",		// 时区，与chrome取法相同
	"browserIconPath": "D:\\lumi.ico",	// 任务栏图标
	"appLocale": "zh-CN",				// 界面语言
	"acceptLang": "en-US",				// js语言
	"audioBuffer": {					
		"enableAudioBufferNoise": false,
		"audioBufferNoiseValue": 0.213254345		// 0-1之间随机
	},
	"canvasContext": {
		"enableCanvasContextNoise": true,
		"canvasContextNoiseValue": 0.2034342344 	// 0-1之间随机
	},
	"clientRects": {
		"enable": true,
		"clientRectsNoiseFactorX": 0.1,			// 0-1之间随机
		"clientRectsNoiseFactorY": 0.0093456	// 0-1之间随机
	},
	"webGL": {									// webgl 与chrome相同
		"enableWebGLRendererNoise": true,
		"webglRenderer": "ANGLE (INTEL, INTEL GeForce GTX 1660 Ti (0x00002182) Direct3D11 vs_5_0 ps_5_0, D3D11)",
		"webglVendor": "Google Inc. (INTEL1)",
		"webGLRendererNoiseValue": 0.2343546
	},
	"geoLocation": {						// 地址位置 与chrome相同
		"mode":"allow",
		"enableFakeLocationData": true,
		"locationLatitude": 33.5828,
		"locationLongitude": -111.898,
		"locationAccuracy": 0,
		"locationAltitude": 0
	},
	"doNotTrack": true,
	"imageSizeLimit": -1,
	"disablePlayVideo": false,
	"fproxy": {
		"host": "66.80.103.23",
		"port": 5782,
		"username": "rq9kusin",
		"password": "4FtymAboDQ1i",
		"type": "http",
		"proxyByPassList": "*.ip123.in,*.travel-eye.org"
	},
	"portScan": {
		"enablePortScanWhiteList": true,
		"portScanWhiteList": "8080"
	},
	"screen": {
		"pixelDepth": 48,
		"colorDepth": 48,
		"width": 428,
		"height": 926,
		"availWidth": 428,
		"availHeight": 926,
		"devicePixelRatio": 1
	},
	"speechSynthesis": {     // 用chome语音修改
		"enable": true,
		"voices": [
			{
				"name": "Microsoft Huihui - Chinese (Simplified, PRC)",
				"lang": "zh-CN",
				"isLocalService": true
			},
			{
				"name": "Microsoft Kangkang  - Chinese (Simplified, PRC)",
				"lang": "zh-CN",
				"isLocalService": true
			},
			{
				"name": "Microsoft Huihui Desktop - Chinese (Simplified, PRC)",
				"lang": "zh-CN",
				"isLocalService": true
			},
			{
				"name": "Microsoft Zira Desktop - English (United States)",
				"lang": "en-US",
				"isLocalService": true
			}
		]
	},
	"webrtc": {
		"mode": "altered",
		"loaclIP": "2603:800c:4840:88:ec8f:1c67:f09b:e90",
		"remoteIP": "2603:800c:4840:88:ec8f:1c67:f09b:e90"
	},
	"allowDomains": [],				
	"disableDomains": [],
	"blockDomainPageFile": "D:\\RoxybrowserDev1\\resources\\app.asar.unpacked\\dist\\web\\blockDomain.html",
	"autofillWebSiteMult": [
		{
			"url": "http://admin1.rola-ip.co",
			"username": "aws",
			"password": "nanshanfeifei520"
		},
		{
			"url": "https://console.rola-ip.co/login",
			"username": "aws",
			"password": "nanshanfeifei520"
		}
	],
	"disablePlayVideo": true,
	"disablePlaySound": true,
	"disablePasswordSaveTips":false,
	"allowFontList": "Al Bayan;Al Nile;Al Tarikh;American Typewriter;Andale Mono;Apple Braille;Apple Chancery;Apple Color Emoji;Apple SD Gothic Neo;Apple Symbols;AppleGothic;AppleMyungjo;Arial Black;Arial Hebrew;Arial Narrow;Arial Rounded MT Bold;Arial Unicode MS;Arial;Avenir Next Condensed;Avenir Next;Avenir;Ayuthaya;Baghdad;Bangla MN;Bangla Sangam MN;Baskerville;Beirut;Big Caslon;Bodoni Ornaments;Bradley Hand;Brush Script MT;Chalkboard SE;Chalkboard;Chalkduster;Cochin;Comic Sans MS;Copperplate;Corsiva Hebrew;Courier New;Damascus;DecoType Naskh;Devanagari MT;Devanagari Sangam MN;Didot;Diwan Kufi;Diwan Thuluth;Euphemia UCAS;Farah;Farisi;Futura;GB18030 Bitmap;Geeza Pro;Geneva;Georgia;Gill Sans;Gujarati MT;Gujarati Sangam MN;Gurmukhi MN;Gurmukhi MT;Gurmukhi Sangam MN;Heiti SC;Helvetica Neue;Helvetica;Herculanum;Hiragino Sans GB;Hiragino Sans;Hoefler Text;ITF Devanagari;Impact;InaiMathi;Kannada MN;Kefa;Khmer MN;Khmer Sangam MN;Kohinoor Bangla;Kohinoor Telugu;Kokonor;Krungthep;KufiStandardGK;Lao MN;Lao Sangam MN;Lucida Grande;Luminari;Marker Felt;Menlo;Microsoft Sans Serif;Mishafi Gold;Monaco;Mshtakan;Muna;Nadeem;New Peninim MT;Noteworthy;Optima;Oriya Sangam MN;PT Mono;PT Sans Caption;PT Sans Narrow;PT Sans;PT Serif Caption;PT Serif;Palatino;Papyrus;Phosphate;PingFang HK;Plantagenet Cherokee;Raanana;STIXGeneral;STIXIntegralsD;STIXIntegralsSm;STIXIntegralsUp;STIXIntegralsUpD;STIXIntegralsUpSm;STIXSizeFiveSym;STIXSizeFourSym;STIXSizeOneSym;STIXSizeThreeSym;STIXSizeTwoSym;STIXVariants;STSong;Sana;Sathu;Savoye LET;SignPainter;Silom;Sinhala Sangam MN;Skia;Snell Roundhand;Songti SC;Sukhumvit Set;Symbol;Tahoma;Tamil Sangam MN;Telugu Sangam MN;Thonburi;Trattatello;Trebuchet MS;Verdana;Waseem;Zapfino;Charter;DIN Alternate;DIN Condensed;Noto Nastaliq Urdu;Rockwell;Zapf Dingbats;Courier;BlinkMacSystemFont;Mishafi;Myanmar MN;Myanmar Sangam MN;Oriya MN;Songti TC;Tamil MN;Telugu MN;Webdings;Wingdings;NSimsun;Simsun;Noto Sans SC",
	"windowName":"测试窗口名称",
	"simulation": {			// 粘贴仿真
        "minDelay": 200,
        "maxDelay":500,
        "enable": true,
        "shortcutKey": "Ctrl Shift E"
    },
	"sessionStorageSync": {			// session  storage 同步
		"enable":true,
		"allowDomains":["ip123.in"]
	},
  "searchEngine": {				// 搜索引擎
    "name": "Google"
  }
}
```

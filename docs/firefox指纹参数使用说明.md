# 1. RoxyFirefox启动
```RoxyFirefox -profile data-dir  --remote-debugging-port=0  url1 url2 ...```
## 参数说明:
- ```-profile data-dir``` 指定数据目录，每个窗口一个，与chrome的user-data-dir意义一样，启动之前先创建data-dir目录，将加密后的指纹内容写入 ```data-dir/lumi.conf```中
- 指纹加密方法：```des-cbc```，key:```402ead7d```, iv: ```3a105229```
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
	"userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.5; rv:132.0) Gecko/20100101 Firefox/132.0",
	"navigator": {
		"platform": "Linux x86_64",  // 平台：windows：Win32, Mac: MacIntel, Linux: Linux x86_64, IOS:iPhone, Android: Linux armv81
		"hardwareConcurrency": 4,
		"maxTouchPoints": 5,		// 移动端使用，IOS填 5，adnroid： ？
		"deviceMemory": 16,
		"mobile":false				// 是否为移动端，为true的时候会自动打开仿真页面
	},
	"windowNum": 22,                        // 窗口编号
	"timeZone": "America/New_York",         // 时区
	"browserIconPath": "D:\\lumi.ico",      // 任务栏图标
	"appLocale": "zh-CN",                   // 界面语言
	"acceptLang": "en-US",                  // acceptLang 语言
	"audioBuffer": {                        // audio指纹
		"enableAudioBufferNoise": true,
		"audioBufferNoiseValue": 0.213254345
	},
	"canvasContext": {                      // canvas指纹
		"enableCanvasContextNoise": true,
		"canvasContextNoiseValue": 0.2034342344
	},
	"clientRects": {                        // clientRects指纹
		"enable": true,
		"clientRectsNoiseFactorX": 0.1,
		"clientRectsNoiseFactorY": 0.0093456
	},
	"webGL": {                              // webGl指纹
		"enableWebGLRendererNoise": true,
		"webglRenderer": "ANGLE (INTEL, INTEL GeForce GTX 1660 Ti (0x00002182) Direct3D11 vs_5_0 ps_5_0, D3D11)",
		"webglVendor": "Google Inc. (INTEL1)",
		"webGLRendererNoiseValue": 0.2343546
	},
	"geoLocation": {                        // 地理位置
		"mode":"disable",                   // disable：禁止，其他的值表示允许，
		"enableFakeLocationData": true,     // 决定是否用下面的值来替换真实值
		"locationLatitude": 33.5828,
		"locationLongitude": -111.898,
		"locationAccuracy": 0,
		"locationAltitude": 0
	},
	"doNotTrack": true,             
	"imageSizeLimit": -1,                   // 禁止加载指定大小的图片，-1表示不禁止，单位KB
	"fproxy": {                             // 代理支持 http,https,socks5，不设置表示不走代理
		"host": "gate.rola.vip",
		"port": 1000,
		"username": "rola690_2344-country-us",
		"password": "isdufh984e",
		"type": "http",
		"proxyByPassList": "*.ip123.in,*.travel-eye.org"
	},
	"portScan": {                           // 端口扫描保护
		"enablePortScanWhiteList": true,
		"portScanWhiteList": "8080"
	},
	"screen": {                             // 屏幕指纹
		"pixelDepth": 48,
		"colorDepth": 48,
		"width": 1000,
		"height": 1000,
		"availWidth": 1000,
		"availHeight": 1000,
		"devicePixelRatio": 1
	},
	"speechSynthesis": {                    // speech指纹
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
		"mode": "altered",      // 禁止：disable，替换：altered，跟随系统：real
		"loaclIP": "2603:800c:4840:88:ec8f:1c67:f09b:e90",
		"remoteIP": "2603:800c:4840:88:ec8f:1c67:f09b:e90"
	},
	"allowDomains": [],         // 域名白名单
	"disableDomains": [],       // 域名黑名单
	"blockDomainPageFile": "D:\\RoxybrowserDev1\\resources\\app.asar.unpacked\\dist\\web\\blockDomain.html",
	"autofillWebSiteMult": [    // 账号平台，自动填充账号密码
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
	"windowName":"窗口名称",
	"simulation": {  // 粘贴仿真
        "delay": 200,
        "enable": true,
        "shortcutKey": "Ctrl Shift E"
    }
}
```

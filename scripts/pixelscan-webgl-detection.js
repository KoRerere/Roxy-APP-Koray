/**
 * Pixelscan WebGL / Canvas 指纹噪音检测逻辑复现
 *
 * 来源: pixelscan.net fingerprint-check 页面 (chunk 997.dfab18f18fe7fe9c.js)
 * 用法:
 *   浏览器: 打开 DevTools Console，粘贴本文件内容，或 <script src="..."></script> 后调用 runPixelscanDetection()
 *   Node: 不支持（依赖 DOM / WebGL / Worker）
 *
 * 检测项:
 *   1. getWebglFp        - WebGL 渲染 + readPixels 指纹
 *   2. getWebglMeta      - 全量 WebGL getParameter 枚举
 *   3. getFixedRedBoxHash - 固定红块 readPixels SHA-256（核心噪音检测）
 *   4. canvasNoiseOn2d   - Canvas 2D 纯色块像素完整性
 *   5. checkWebworkerValues - Worker OffscreenCanvas 与主线程 GPU 信息交叉验证
 *   6. checkWebglMetaServer - 可选，调用 Pixelscan /cwg API 校验 vendor/renderer
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 常量（与 Pixelscan 源码一致）
  // ---------------------------------------------------------------------------

  const WEBGL_PARAM_INDEX = {
    VERSION: 26,
    UNMASKED_VENDOR: 27,
    UNMASKED_RENDERER: 28,
  };

  /** Pixelscan 在「无噪音」Chrome 环境下测得的固定红块 SHA-256 hex */
  const CLEAN_RED_BOX_SHA256 =
    'bf9da7959d914298f9ce9e41a480fd66f76fac5c6f5e0a9b5a99b18cfc6fd997';

  const PIXELSCAN_API_BASE = 'https://pixelscan.net/api'; // 可按实际 endpoint 调整

  // ---------------------------------------------------------------------------
  // 工具函数
  // ---------------------------------------------------------------------------

  /** MurmurHash3 32-bit（Pixelscan 使用类似 appendStr/end 的流式 hash） */
  function murmurHash3(str, seed = 0) {
    let h = seed >>> 0;
    const len = str.length;
    let i = 0;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;

    while (i + 4 <= len) {
      let k =
        (str.charCodeAt(i) & 0xff) |
        ((str.charCodeAt(i + 1) & 0xff) << 8) |
        ((str.charCodeAt(i + 2) & 0xff) << 16) |
        ((str.charCodeAt(i + 3) & 0xff) << 24);
      i += 4;
      k = Math.imul(k, c1);
      k = (k << 15) | (k >>> 17);
      k = Math.imul(k, c2);
      h ^= k;
      h = (h << 13) | (h >>> 19);
      h = Math.imul(h, 5) + 0xe6546b64;
    }

    let k = 0;
    switch (len - i) {
      case 3:
        k ^= (str.charCodeAt(i + 2) & 0xff) << 16;
      // fallthrough
      case 2:
        k ^= (str.charCodeAt(i + 1) & 0xff) << 8;
      // fallthrough
      case 1:
        k ^= str.charCodeAt(i) & 0xff;
        k = Math.imul(k, c1);
        k = (k << 15) | (k >>> 17);
        k = Math.imul(k, c2);
        h ^= k;
    }

    h ^= len;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function buf2hex(buffer) {
    return Array.prototype.map
      .call(new Uint8Array(buffer), (b) => `00${b.toString(16)}`.slice(-2))
      .join('');
  }

  async function sha256(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return buf2hex(digest);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function formatGlParam(value) {
    if (value == null) return '';
    if (Array.isArray(value) || (value.length !== undefined && typeof value !== 'string')) {
      return Array.from(value).join(',');
    }
    return String(value);
  }

  function parseUaBrowser(ua = navigator.userAgent) {
    const chrome = /Chrome\/([\d.]+)/i.exec(ua);
    const edge = /Edg\/([\d.]+)/i.exec(ua);
    const opera = /OPR\/([\d.]+)/i.exec(ua);
    if (edge) return { name: 'Edge', version: parseFloat(edge[1]), chromiumBased: true };
    if (opera) return { name: 'Opera', version: parseFloat(opera[1]), chromiumBased: true };
    if (chrome) return { name: 'Chrome', version: parseFloat(chrome[1]), chromiumBased: true };
    return { name: 'Other', version: 0, chromiumBased: false };
  }

  function shouldCheckWorkerWebgl(browser) {
    if (!browser.chromiumBased) return false;
    if (browser.name === 'Chrome' && browser.version >= 69) return true;
    if (browser.name === 'Edge' && browser.version >= 79) return true;
    if (browser.name === 'Opera' && browser.version >= 64) return true;
    return false;
  }

  // ---------------------------------------------------------------------------
  // 1. WebGL Context
  // ---------------------------------------------------------------------------

  function getWebglCanvas() {
    const canvas = document.createElement('canvas');
    let gl = null;
    try {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch {
      /* ignore */
    }
    if (!gl || !(gl instanceof WebGLRenderingContext)) return null;
    return gl;
  }

  // ---------------------------------------------------------------------------
  // 2. WebGL 指纹采集 (getWebglFp)
  // ---------------------------------------------------------------------------

  /**
   * 绘制三角形 + readPixels + 收集 WebGL 参数
   * @returns {Promise<{ webglParams: string[], webglHash: string, unmaskedVendor: string, unmaskedRenderer: string, version: string }>}
   */
  async function getWebglFp() {
    const gl = getWebglCanvas();
    if (!gl) {
      return {
        webglParams: null,
        webglHash: null,
        unmaskedVendor: null,
        unmaskedRenderer: null,
        version: null,
        error: 'WebGL not available',
      };
    }

    const params = [];

    const paramToStr = (value) => {
      gl.clearColor(0, 0, 0, 1);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      return formatGlParam(value);
    };

    // --- 绘制三角形 strip ---
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const vertices = new Float32Array([-0.2, -0.9, 0, 0.4, -0.26, 0, 0, 0.732134444, 0]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const program = gl.createProgram();
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(
      vertShader,
      'attribute vec2 attrVertex;varying vec2 varyinTexCoordinate;uniform vec2 uniformOffset;void main(){varyinTexCoordinate=attrVertex+uniformOffset;gl_Position=vec4(attrVertex,0,1);}'
    );
    gl.compileShader(vertShader);

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(
      fragShader,
      'precision mediump float;varying vec2 varyinTexCoordinate;void main() {gl_FragColor=vec4(varyinTexCoordinate,0,1);}'
    );
    gl.compileShader(fragShader);

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const attrLoc = gl.getAttribLocation(program, 'attrVertex');
    const uniformLoc = gl.getUniformLocation(program, 'uniformOffset');
    gl.enableVertexAttribArray(attrLoc);
    gl.vertexAttribPointer(attrLoc, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniformLoc, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);

    // --- readPixels（噪音检测最敏感项，webglHash 仅 hash 此字符串）---
    try {
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      params.push(pixels.join(''));
    } catch {
      params.push('');
    }

    params.push('extensions:' + (gl.getSupportedExtensions() || []).join(';'));
    params.push('webgl aliased line width range' + paramToStr(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)));
    params.push('webgl aliased point size range' + paramToStr(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)));
    params.push('webgl alpha bits:' + gl.getParameter(gl.ALPHA_BITS));
    params.push(
      'webgl antialiasing:' + (gl.getContextAttributes().antialias ? 'yes' : 'no')
    );
    params.push('webgl blue bits:' + gl.getParameter(gl.BLUE_BITS));
    params.push('webgl depth bits:' + gl.getParameter(gl.DEPTH_BITS));
    params.push('webgl green bits:' + gl.getParameter(gl.GREEN_BITS));

    // max anisotropy
    {
      const ext =
        gl.getExtension('EXT_texture_filter_anisotropic') ||
        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
        gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
      let aniso = '';
      if (ext) {
        aniso = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        if (aniso === 0) aniso = 2;
      }
      params.push('webgl max anisotropy:' + aniso);
    }

    params.push(
      'webgl max combined texture image units:' + gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)
    );
    params.push('webgl max cube map texture size:' + gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE));
    params.push(
      'webgl max fragment uniform vectors:' + gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)
    );
    params.push('webgl max render buffer size:' + gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    params.push('webgl max texture image units:' + gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
    params.push('webgl max texture size:' + gl.getParameter(gl.MAX_TEXTURE_SIZE));
    params.push('webgl max varying vectors:' + gl.getParameter(gl.MAX_VARYING_VECTORS));
    params.push('webgl max vertex attribs:' + gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
    params.push(
      'webgl max vertex texture image units:' + gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)
    );
    params.push('webgl max vertex uniform vectors:' + gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS));
    params.push('webgl max viewport dims:' + paramToStr(gl.getParameter(gl.MAX_VIEWPORT_DIMS)));
    params.push('webgl red bits:' + gl.getParameter(gl.RED_BITS));
    params.push(String(gl.getParameter(gl.RENDERER)));
    params.push('webgl shading language version:' + gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
    params.push('webgl stencil bits:' + gl.getParameter(gl.STENCIL_BITS));
    params.push(String(gl.getParameter(gl.VENDOR)));
    params.push(String(gl.getParameter(gl.VERSION)));

    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        params.push(String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)));
        params.push(String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)));
      }
    } catch {
      /* ignore */
    }

    // shader precision
    if (gl.getShaderPrecisionFormat) {
      ['FLOAT', 'INT'].forEach((numType) => {
        ['VERTEX', 'FRAGMENT'].forEach((shaderType) => {
          ['HIGH', 'MEDIUM', 'LOW'].forEach((precision) => {
            ['precision', 'rangeMin', 'rangeMax'].forEach((field) => {
              const fmt = gl.getShaderPrecisionFormat(
                gl[shaderType + '_SHADER'],
                gl[precision + '_' + numType]
              );
              const label = field === 'precision' ? field : 'precision ' + field;
              const val = fmt[field];
              params.push(
                ['webgl ', shaderType.toLowerCase(), ' shader ', precision.toLowerCase(), ' ', numType.toLowerCase(), ' ', label, ':', val].join('')
              );
            });
          });
        });
      });
    }

    const loseExt = gl.getExtension('WEBGL_lose_context');
    loseExt?.loseContext();

    await sleep(0);

    const webglHash = typeof params[0] === 'string' ? murmurHash3(params[0]) : null;

    return {
      webglParams: params,
      webglHash,
      unmaskedVendor: params[WEBGL_PARAM_INDEX.UNMASKED_VENDOR] ?? null,
      unmaskedRenderer: params[WEBGL_PARAM_INDEX.UNMASKED_RENDERER] ?? null,
      version: params[WEBGL_PARAM_INDEX.VERSION] ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. WebGL Meta 全量参数 hash (getwebglMeta)
  // ---------------------------------------------------------------------------

  function collectWebglMetaEntries(gl, extensionObj = null, extensionName = '') {
    const proto = Object.getPrototypeOf(extensionObj || gl);
    const entries = [];
    for (const key in proto) {
      const val = extensionObj ? proto[key] : gl[key];
      if (typeof val !== 'number') continue;
      try {
        const paramVal = gl.getParameter(val);
        if (paramVal !== null) {
          entries.push({
            name: key,
            value: paramVal,
            code: val,
            extensionName,
          });
        }
      } catch {
        /* ignore */
      }
    }
    return entries;
  }

  async function getWebglMeta() {
    const meta = [];
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { webglMetaHash: null, entries: [] };

      meta.push(...collectWebglMetaEntries(gl));
      const extensions = gl.getSupportedExtensions() || [];
      for (let i = 0; i < extensions.length; i++) {
        const name = extensions[i];
        const ext = gl.getExtension(name);
        meta.push(...collectWebglMetaEntries(gl, ext, name));
      }
    } catch {
      /* ignore */
    }

    const json = JSON.stringify(meta);
    return {
      webglMetaHash: murmurHash3(json),
      entries: meta,
      jsonLength: json.length,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. 固定红块 WebGL 噪音检测 (getFixedRedBoxHash)
  // ---------------------------------------------------------------------------

  function drawRedRectangle(canvas) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl || !(gl instanceof WebGLRenderingContext)) return null;

    const indices = [3, 2, 1, 3, 1, 0];

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.75, 0.75, 0, -0.75, -0.75, 0, 0.75, -0.75, 0, 0.75, 0.75, 0]),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, 'attribute vec3 coordinates;void main(void) { gl_Position = vec4(coordinates, 1.0);}');
    gl.compileShader(vert);

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, 'void main(void) { gl_FragColor = vec4(255, 0, 0, 1);}');
    gl.compileShader(frag);

    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const coordLoc = gl.getAttribLocation(prog, 'coordinates');
    gl.vertexAttribPointer(coordLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coordLoc);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    return gl;
  }

  /**
   * 读取红块 readPixels 并计算 SHA-256
   * @returns {Promise<{ hash: string, noNoise: boolean, expected: string }>}
   */
  async function getFixedRedBoxHash(options = {}) {
    const expected = options.expectedHash ?? CLEAN_RED_BOX_SHA256;
    const container = options.container ?? document.body;

    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 24;

        drawRedRectangle(canvas);

        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
        holder.appendChild(canvas);
        container.appendChild(holder);

        setTimeout(() => {
          try {
            const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
            if (!gl) {
              holder.remove();
              resolve({ hash: '', noNoise: false, expected, error: 'no webgl context' });
              return;
            }

            const buf = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, buf);

            setTimeout(async () => {
              try {
                const hash = await sha256(buf.buffer);
                holder.remove();
                resolve({
                  hash,
                  noNoise: hash === expected,
                  expected,
                });
              } catch {
                holder.remove();
                resolve({ hash: '', noNoise: false, expected, error: 'sha256 failed' });
              }
            }, 500);
          } catch {
            holder.remove();
            resolve({ hash: '', noNoise: false, expected, error: 'readPixels failed' });
          }
        }, 500);
      } catch {
        resolve({ hash: '', noNoise: false, expected, error: 'setup failed' });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Canvas 2D 噪音检测 (canvasNoiseOn2d / CANVAS_NOISE)
  // ---------------------------------------------------------------------------

  const CANVAS_TEST_COLORS = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
    [1, 1, 1],
    [254, 254, 254],
    [0, 0, 0],
    [51, 51, 51],
    [102, 102, 102],
    [153, 153, 153],
    [204, 204, 204],
    [255, 255, 255],
  ];

  async function runCanvasBlockTest(blockW, blockH) {
    const canvas = document.createElement('canvas');
    let passed = null;

    try {
      document.body.appendChild(canvas);

      const toDataUrlStr = canvas.toDataURL.toString();
      const isNativeToDataURL =
        [42, 38].includes(toDataUrlStr.length) && /(native code)/.test(toDataUrlStr);

      if (!isNativeToDataURL) {
        document.body.removeChild(canvas);
        return false;
      }

      Object.assign(canvas, {
        width: blockW * CANVAS_TEST_COLORS.length,
        height: blockH,
      });

      const ctx = canvas.getContext('2d');
      CANVAS_TEST_COLORS.forEach((rgb, i) => {
        ctx.fillStyle =
          '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
        ctx.fillRect(blockW * i, 0, blockW * (1 + i), blockH);
      });

      const dataUrl = canvas.toDataURL();
      const img = document.createElement('img');

      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.src = dataUrl;
      });

      const readCanvas = document.createElement('canvas');
      Object.assign(readCanvas, {
        width: blockW * CANVAS_TEST_COLORS.length,
        height: blockH,
      });
      const readCtx = readCanvas.getContext('2d');
      readCtx.drawImage(img, 0, 0);

      passed = CANVAS_TEST_COLORS.map((rgb, i) => {
        const imageData = readCtx.getImageData(blockW * i, 0, blockW, blockH).data;
        const pixels = new Uint32Array(imageData.buffer);
        const counts = new Map();
        pixels.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
        const expectedPx = new Uint32Array(new Uint8Array([...rgb, 255]).buffer)[0];
        const matchCount = counts.has(expectedPx) ? counts.get(expectedPx) : 0;
        return matchCount === blockW * blockH;
      }).every(Boolean)
        ? dataUrl
        : null;
    } catch {
      passed = null;
    } finally {
      if (canvas.parentNode) document.body.removeChild(canvas);
    }

    return passed;
  }

  /**
   * @returns {Promise<{ pass: boolean, consistent: boolean }>}
   */
  async function canvasNoiseOn2d() {
    try {
      const [run1, run2] = await Promise.all([runCanvasBlockTest(5, 5), runCanvasBlockTest(5, 5)]);
      const pass = !!(run1 && run2 && run1 === run2);
      return { pass, consistent: run1 === run2, run1: !!run1, run2: !!run2 };
    } catch {
      return { pass: false, consistent: false, run1: false, run2: false };
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Web Worker OffscreenCanvas 交叉验证 (checkWebworkerValues)
  // ---------------------------------------------------------------------------

  const WORKER_SCRIPT = `
const fallbackValue = {
  messageSource: 'fpWebworker',
  value: {
    navigatorUa: self.navigator.userAgent,
    offcanvas: null
  }
};
try {
  if (!('OffscreenCanvas' in globalThis)) {
    postMessage(fallbackValue);
  } else {
    const canvas = new OffscreenCanvas(16, 20);
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const extensionDebugRendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    postMessage({
      messageSource: 'fpWebworker',
      value: {
        navigatorUa: self.navigator.userAgent,
        offcanvas: {
          unmasked_vender: gl.getParameter(extensionDebugRendererInfo.UNMASKED_VENDOR_WEBGL),
          unmasked_renderer: gl.getParameter(extensionDebugRendererInfo.UNMASKED_RENDERER_WEBGL)
        }
      }
    });
  }
} catch {
  postMessage(fallbackValue);
}
`;

  /**
   * @param {{ unmaskedVendor: string, unmaskedRenderer: string }} webglFp
   * @returns {Promise<{ pass: boolean, identicalUa: boolean, identicalWebgl: boolean, workerData: object|null }>}
   */
  function checkWebworkerValues(webglFp) {
    const browser = parseUaBrowser();
    const checkWebglInWorker = shouldCheckWorkerWebgl(browser);

    return new Promise((resolve) => {
      try {
        const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);

        const timeout = setTimeout(() => {
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve({
            pass: false,
            identicalUa: false,
            identicalWebgl: false,
            workerData: null,
            error: 'timeout',
          });
        }, 10000);

        worker.onmessage = (event) => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          worker.terminate();

          const { navigatorUa, offcanvas } = event.data.value || {};
          const identicalUa = navigatorUa === navigator.userAgent;

          let identicalWebgl = true;
          if (checkWebglInWorker && offcanvas && webglFp) {
            identicalWebgl =
              webglFp.unmaskedVendor === offcanvas.unmasked_vender &&
              webglFp.unmaskedRenderer === offcanvas.unmasked_renderer;
          }

          resolve({
            pass: identicalUa && identicalWebgl,
            identicalUa,
            identicalWebgl,
            workerData: offcanvas,
            checkWebglInWorker,
          });
        };

        worker.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          resolve({
            pass: false,
            identicalUa: false,
            identicalWebgl: false,
            workerData: null,
            error: 'worker error',
          });
        };
      } catch (err) {
        resolve({
          pass: false,
          identicalUa: false,
          identicalWebgl: false,
          workerData: null,
          error: String(err),
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 7. 服务端 WebGL Meta 校验 (checkWebglMeta → POST /cwg)
  // ---------------------------------------------------------------------------

  /**
   * @param {string} renderer  UNMASKED_RENDERER
   * @param {string} vendor    UNMASKED_VENDOR
   * @param {string} [apiBase]
   * @returns {Promise<{ status: boolean, raw: any }>}
   */
  async function checkWebglMetaServer(renderer, vendor, apiBase = PIXELSCAN_API_BASE) {
    try {
      const res = await fetch(`${apiBase}/cwg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r: renderer, v: vendor }),
        credentials: 'include',
      });
      const data = await res.json();
      return { status: !!data, raw: data };
    } catch (err) {
      return { status: false, raw: null, error: String(err) };
    }
  }

  // ---------------------------------------------------------------------------
  // 8. 辅助检测
  // ---------------------------------------------------------------------------

  /** Pixelscan: navigator 第一个属性名应为空（防 Object 污染检测） */
  function checkFakeNavigatorObject() {
    return !Object.getOwnPropertyNames(navigator)[0];
  }

  function checkIdenticalUserAgent(httpHeaderUa) {
    const headerUa = httpHeaderUa ?? navigator.userAgent;
    return headerUa === navigator.userAgent;
  }

  // ---------------------------------------------------------------------------
  // 9. 汇总运行
  // ---------------------------------------------------------------------------

  /**
   * 运行全部 Pixelscan WebGL/Canvas 噪音相关检测
   *
   * @param {object} [options]
   * @param {boolean} [options.callServer=false] 是否调用 Pixelscan /cwg API
   * @param {string} [options.apiBase] API 地址
   * @param {string} [options.httpHeaderUa] HTTP 请求头中的 User-Agent（用于 UA 一致性）
   * @returns {Promise<object>}
   */
  async function runPixelscanDetection(options = {}) {
    const { callServer = false, apiBase, httpHeaderUa } = options;

    console.group('[Pixelscan WebGL Detection]');

    const webglFp = await getWebglFp();
    console.log('webglFp', webglFp);

    const webglMeta = await getWebglMeta();
    console.log('webglMeta', { hash: webglMeta.webglMetaHash, count: webglMeta.entries.length });

    const redBox = await getFixedRedBoxHash();
    console.log('redBox (noNoise)', redBox);

    const canvas2d = await canvasNoiseOn2d();
    console.log('canvas2d', canvas2d);

    const worker = await checkWebworkerValues(webglFp);
    console.log('worker', worker);

    let serverCheck = { status: null, skipped: true };
    if (callServer && webglFp.unmaskedRenderer && webglFp.unmaskedVendor) {
      serverCheck = await checkWebglMetaServer(
        webglFp.unmaskedRenderer,
        webglFp.unmaskedVendor,
        apiBase
      );
      serverCheck.skipped = false;
      console.log('server /cwg', serverCheck);
    }

    const clearNavigator = checkFakeNavigatorObject();
    const identicalUa = checkIdenticalUserAgent(httpHeaderUa);

    const webglStatus = callServer ? serverCheck.status : true;
    const noNoise = redBox.noNoise;
    const webworkerOk = worker.pass;
    const canvasOk = canvas2d.pass;

    const notMasking =
      webglStatus &&
      webworkerOk &&
      identicalUa &&
      noNoise &&
      clearNavigator &&
      canvasOk;

    const result = {
      summary: {
        notMasking,
        webglStatus,
        noNoise,
        webworkerOk,
        canvas2dOk: canvasOk,
        clearNavigatorObject: clearNavigator,
        identicalUserAgent: identicalUa,
      },
      webglFp,
      webglMeta,
      redBox,
      canvas2d,
      worker,
      serverCheck,
      details: [
        { key: 'webglStatus', value: webglStatus, note: '服务端 /cwg 或跳过时为 true' },
        { key: 'noNoise', value: noNoise, note: '红块 readPixels SHA-256 匹配' },
        { key: 'webworkerValues', value: webworkerOk, note: 'Worker GPU 与主线程一致' },
        { key: 'canvasTest', value: canvasOk, note: 'Canvas 2D 无噪音' },
        { key: 'clearNavigatorObject', value: clearNavigator },
        { key: 'identicalUserAgents', value: identicalUa },
      ],
    };

    console.groupCollapsed('evaluation');
    result.details.forEach((d) => console.log(d.key, d.value, d.note || ''));
    console.log('final notMasking', notMasking);
    console.groupEnd();
    console.groupEnd();

    return result;
  }

  // ---------------------------------------------------------------------------
  // 导出
  // ---------------------------------------------------------------------------

  const api = {
    WEBGL_PARAM_INDEX,
    CLEAN_RED_BOX_SHA256,
    murmurHash3,
    buf2hex,
    sha256,
    getWebglCanvas,
    getWebglFp,
    getWebglMeta,
    drawRedRectangle,
    getFixedRedBoxHash,
    canvasNoiseOn2d,
    checkWebworkerValues,
    checkWebglMetaServer,
    checkFakeNavigatorObject,
    checkIdenticalUserAgent,
    runPixelscanDetection,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.PixelscanWebGLDetection = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);

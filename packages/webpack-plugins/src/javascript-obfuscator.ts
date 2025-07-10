import JavaScriptObfuscator from 'javascript-obfuscator';
import micromatch from 'micromatch';
import type { Compiler } from 'webpack';
import { RawSource } from 'webpack-sources';

interface PluginOptions {
  include?: string[];
  exclude?: string[];
  obfuscatorOptions?: JavaScriptObfuscator.ObfuscatorOptions;
}

export class JavascriptObfuscatorPlugin {
  private options: PluginOptions;

  constructor(options: PluginOptions = {}) {
    this.options = {
      include: ['**/*.js'],  // 支持 micromatch 通配符
      exclude: [],
      obfuscatorOptions: {
        compact: true,
        controlFlowFlattening: true,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        rotateStringArray: true
      },
      ...options
    };
  }

  apply(compiler: Compiler) {
    compiler.hooks.emit.tapAsync(
      'JavascriptObfuscatorPlugin',
      (compilation, callback) => {
        const { include, exclude, obfuscatorOptions } = this.options;
        const assets = compilation.assets;

        Object.keys(assets).forEach((filename) => {
          if (
            micromatch.isMatch(filename, include || []) &&
            !micromatch.isMatch(filename, exclude || [])
          ) {
            const asset = assets[filename];
            const source = asset.source().toString();

            const obfuscationResult = JavaScriptObfuscator.obfuscate(
              source,
              obfuscatorOptions
            );

            // 替换原始输出内容
            assets[filename] = new RawSource(obfuscationResult.getObfuscatedCode());
          }
        });

        callback();
      }
    );
  }
}

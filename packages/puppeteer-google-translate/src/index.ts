import { GoogleTranslator } from './google-translator';

(async () => {

  const googleTranslator = new GoogleTranslator();

  googleTranslator.translateText('hello world!  I like you', 'auto', 'zh-CN');
  googleTranslator.translateText('hello world2!  I like you', 'auto', 'zh-CN');
  googleTranslator.translateText('hello world3!  I like you', 'auto', 'zh-CN');
})();
